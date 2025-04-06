// Global variables
let isDebugging = false;
let attachedTabId = null;
let urlPatterns = [];
let pendingResponses = {}; // Store intercepted responses
let responseModifiers = {}; // Store response modifiers

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Network Request Interceptor extension installed');
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'startDebugging') {
    startDebugging()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Error starting debugging:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates we'll respond asynchronously
  }
  
  else if (message.action === 'stopDebugging') {
    stopDebugging()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Error stopping debugging:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates we'll respond asynchronously
  }
  
  else if (message.action === 'getDebuggingStatus') {
    sendResponse({ isDebugging });
    return false; // Indicates we've responded synchronously
  }
  
  else if (message.action === 'getPendingResponses') {
    sendResponse({ pendingResponses });
    return false; // Indicates we've responded synchronously
  }
  
  else if (message.action === 'getResponseDetails') {
    const { requestId } = message;
    if (pendingResponses[requestId]) {
      sendResponse({ success: true, response: pendingResponses[requestId] });
    } else {
      sendResponse({ success: false, error: 'Response not found' });
    }
    return false; // Indicates we've responded synchronously
  }
  
  else if (message.action === 'approveResponse') {
    const { requestId, modifications } = message;
    
    if (!pendingResponses[requestId]) {
      sendResponse({ success: false, error: 'Response not found' });
      return false;
    }
    
    // Apply modifications if provided
    if (modifications) {
      applyResponseModifications(requestId, modifications)
        .then(() => {
          // Remove from pending responses
          delete pendingResponses[requestId];
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('Error applying modifications:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Indicates we'll respond asynchronously
    } else {
      // No modifications, just continue the request
      if (attachedTabId !== null) {
        chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Fetch.continueRequest',
          { requestId },
          () => {
            console.log(`Request ${requestId} continued without modifications`);
            // Remove from pending responses
            delete pendingResponses[requestId];
            sendResponse({ success: true });
          }
        );
        return true; // Indicates we'll respond asynchronously
      } else {
        // No active debugging session
        delete pendingResponses[requestId];
        sendResponse({ success: true });
        return false;
      }
    }
  }
});

// Apply modifications to a response
async function applyResponseModifications(requestId, modifications) {
  if (!attachedTabId) {
    throw new Error('No active debugging session');
  }
  
  const pendingResponse = pendingResponses[requestId];
  if (!pendingResponse) {
    throw new Error('Response not found');
  }
  
  try {
    // Check if body was modified
    if (modifications.body && modifications.body !== pendingResponse.body) {
      console.log('Body was modified, attempting to apply changes');
      
      try {
        // Get original response body format
        const responseBodyResult = await new Promise((resolve, reject) => {
          chrome.debugger.sendCommand(
            { tabId: attachedTabId },
            'Fetch.getResponseBody',
            { requestId },
            (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(result);
              }
            }
          );
        });
        
        // Determine if the original response was base64 encoded
        const base64Encoded = responseBodyResult.base64Encoded;
        
        // Prepare the modified body in the correct format
        let modifiedBody = modifications.body;
        if (base64Encoded) {
          // If original was base64, we need to encode our modified body
          try {
            modifiedBody = btoa(modifiedBody);
          } catch (e) {
            console.error('Error encoding body to base64:', e);
            // If encoding fails, just use the original format
            modifiedBody = responseBodyResult.body;
          }
        }
        
        // Prepare response headers
        let responseHeaders = pendingResponse.headers;
        if (modifications.headers) {
          responseHeaders = modifications.headers;
        }
        
        // Convert headers object to array format required by Fetch API
        const headersArray = [];
        for (const [name, value] of Object.entries(responseHeaders)) {
          headersArray.push({ name, value });
        }
        
        // Prepare status code
        let statusCode = pendingResponse.status;
        if (modifications.status) {
          statusCode = modifications.status;
        }
        
        // Fulfill the request with modified response
        await chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Fetch.fulfillRequest',
          {
            requestId,
            responseCode: statusCode,
            responseHeaders: headersArray,
            body: modifiedBody,
            base64Encoded: base64Encoded
          }
        );
        
        console.log('Successfully applied modified response');
        return true;
      } catch (modError) {
        console.error('Error modifying response:', modError);
        // If modification fails, fall back to continuing the request
        await chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Fetch.continueRequest',
          { requestId }
        );
        console.log('Continued request after modification error');
        return true;
      }
    } else {
      // No body modifications, just continue the request
      await chrome.debugger.sendCommand(
        { tabId: attachedTabId },
        'Fetch.continueRequest',
        { requestId }
      );
      console.log(`Request ${requestId} continued without modifications`);
      return true;
    }
  } catch (error) {
    console.error('Error in applyResponseModifications:', error);
    
    // If there's an error, try to continue the request anyway to prevent hanging
    try {
      await chrome.debugger.sendCommand(
        { tabId: attachedTabId },
        'Fetch.continueRequest',
        { requestId }
      );
      console.log(`Request ${requestId} continued despite error`);
    } catch (continueError) {
      console.error('Error continuing request:', continueError);
    }
    
    throw error;
  }
}

// Start debugging
async function startDebugging() {
  // If already debugging, stop first
  if (isDebugging) {
    await stopDebugging();
  }
  
  // Get URL patterns from storage
  const result = await chrome.storage.local.get(['urlPatterns']);
  urlPatterns = result.urlPatterns || [];
  
  if (urlPatterns.length === 0) {
    throw new Error('No URL patterns to intercept');
  }
  
  // Get active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) {
    throw new Error('No active tab found');
  }
  
  const tabId = tabs[0].id;
  
  // Attach debugger to the tab
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    console.log(`Debugger attached to tab ${tabId}`);
    
    // First disable Network domain to avoid conflicts
    await chrome.debugger.sendCommand({ tabId }, 'Network.disable');
    
    // Enable Fetch domain for request interception
    // This is the key part - we're intercepting ALL requests at the Response stage
    await chrome.debugger.sendCommand(
      { tabId },
      'Fetch.enable',
      {
        patterns: [
          { 
            urlPattern: '*', 
            requestStage: 'Response'
            // Removed invalid resourceType: '*'
          }
        ]
      }
    );
    console.log('Fetch domain enabled for response interception');
    
    // Set up event listeners for debugger events
    chrome.debugger.onEvent.addListener(debuggerEventListener);
    
    // Set global state
    isDebugging = true;
    attachedTabId = tabId;
    pendingResponses = {};
    
    console.log('Debugging started successfully');
    return true;
  } catch (error) {
    console.error('Error attaching debugger:', error);
    throw error;
  }
}

// Stop debugging
async function stopDebugging() {
  if (!isDebugging || attachedTabId === null) {
    console.log('Not currently debugging');
    return true;
  }
  
  try {
    // Continue any pending requests before disabling
    const pendingRequestIds = Object.keys(pendingResponses);
    for (const requestId of pendingRequestIds) {
      try {
        await chrome.debugger.sendCommand(
          { tabId: attachedTabId },
          'Fetch.continueRequest',
          { requestId }
        );
        console.log(`Continued pending request ${requestId} before stopping`);
      } catch (error) {
        console.error(`Error continuing request ${requestId}:`, error);
      }
    }
    
    // Disable Fetch domain
    await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.disable');
    console.log('Fetch domain disabled');
    
    // Disable network tracking
    await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Network.disable');
    console.log('Network tracking disabled');
    
    // Detach debugger
    await chrome.debugger.detach({ tabId: attachedTabId });
    console.log(`Debugger detached from tab ${attachedTabId}`);
    
    // Remove event listener
    chrome.debugger.onEvent.removeListener(debuggerEventListener);
    
    // Reset global state
    isDebugging = false;
    attachedTabId = null;
    pendingResponses = {};
    
    console.log('Debugging stopped successfully');
    return true;
  } catch (error) {
    console.error('Error stopping debugging:', error);
    throw error;
  }
}

// Debugger event listener
function debuggerEventListener(debuggeeId, message, params) {
  if (debuggeeId.tabId !== attachedTabId) {
    return;
  }
  
  // Handle fetch events
  if (message.startsWith('Fetch.')) {
    switch (message) {
      case 'Fetch.requestPaused':
        handleRequestPaused(params);
        break;
    }
  }
}

// Handle paused request
function handleRequestPaused(params) {
  const { requestId, request, responseStatusCode, responseHeaders, resourceType } = params;
  const url = request.url;
  
  console.log(`🟡 REQUEST PAUSED: ${url}`);
  console.log('Request ID:', requestId);
  console.log('Resource Type:', resourceType);
  
  // Check if this URL should be intercepted based on our patterns
  if (shouldInterceptUrl(url)) {
    // This is a URL we want to intercept
    console.log(`Intercepting response for ${url}`);
    
    // Get response body
    chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      'Fetch.getResponseBody',
      { requestId },
      (responseBody) => {
        if (responseBody) {
          let body = responseBody.base64Encoded ? 
            atob(responseBody.body) : 
            responseBody.body;
          
          // Store response info
          pendingResponses[requestId] = {
            url,
            status: responseStatusCode,
            statusText: getStatusText(responseStatusCode),
            headers: responseHeadersToObject(responseHeaders),
            mimeType: getMimeTypeFromHeaders(responseHeaders),
            type: resourceType,
            timestamp: Date.now(),
            body: body,
            isWaiting: true
          };
          
          // Notify popup about new pending response
          chrome.runtime.sendMessage({
            action: 'newPendingResponse',
            requestId,
            url,
            status: responseStatusCode,
            statusText: getStatusText(responseStatusCode),
            type: resourceType,
            mimeType: getMimeTypeFromHeaders(responseHeaders)
          });
          
          console.log(`Response for ${url} is now pending user approval`);
        } else {
          // If we can't get the response body, just continue the request
          continueRequest(requestId);
        }
      }
    );
  } else {
    // This is not a URL we want to intercept, continue the request
    continueRequest(requestId);
  }
}

// Helper function to continue a request
function continueRequest(requestId) {
  if (attachedTabId !== null) {
    chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      'Fetch.continueRequest',
      { requestId },
      () => {
        console.log(`Continued request ${requestId}`);
      }
    );
  }
}

// Helper function to get status text from status code
function getStatusText(statusCode) {
  const statusTexts = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  
  return statusTexts[statusCode] || 'Unknown';
}

// Helper function to convert response headers array to object
function responseHeadersToObject(headers) {
  const result = {};
  if (Array.isArray(headers)) {
    headers.forEach(header => {
      result[header.name] = header.value;
    });
  }
  return result;
}

// Helper function to get MIME type from headers
function getMimeTypeFromHeaders(headers) {
  if (Array.isArray(headers)) {
    const contentType = headers.find(h => h.name.toLowerCase() === 'content-type');
    if (contentType) {
      return contentType.value.split(';')[0].trim();
    }
  }
  return 'text/plain';
}

// Check if content type is text-based
function isTextBasedContent(mimeType) {
  if (!mimeType) return false;
  
  const textTypes = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-javascript'
  ];
  
  return textTypes.some(type => mimeType.includes(type));
}

// Check if a URL should be intercepted based on our patterns
function shouldInterceptUrl(url) {
  if (!url) return false;
  
  return urlPatterns.some(pattern => {
    // Simple string match (contains)
    return url.includes(pattern);
  });
}

// Handle debugger detached event
chrome.debugger.onDetach.addListener((debuggeeId, reason) => {
  if (debuggeeId.tabId === attachedTabId) {
    console.log(`Debugger detached: ${reason}`);
    isDebugging = false;
    attachedTabId = null;
  }
});
