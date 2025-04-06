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
      // No modifications, just remove from pending
      delete pendingResponses[requestId];
      sendResponse({ success: true });
      return false;
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
  
  // Apply status code and headers modifications if provided
  if (modifications.status || modifications.headers) {
    // Currently, Chrome DevTools Protocol doesn't provide a direct way to modify
    // status code and headers after they've been received.
    // This would require more advanced interception techniques.
    console.log('Note: Status code and headers modification is not fully supported');
  }
  
  // Apply body modifications if provided
  if (modifications.body && pendingResponse.body !== modifications.body) {
    await chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      'Network.getResponseBody',
      { requestId },
      async (response) => {
        if (response && response.body) {
          try {
            // Set the modified response body
            await chrome.debugger.sendCommand(
              { tabId: attachedTabId },
              'Network.setResponseBody',
              {
                requestId: requestId,
                body: modifications.body
              }
            );
            console.log('Modified response body applied');
          } catch (error) {
            console.error('Error modifying response:', error);
            throw error;
          }
        }
      }
    );
  }
  
  return true;
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
    
    // Enable network tracking
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
    console.log('Network tracking enabled');
    
    // Set up event listeners for network events
    chrome.debugger.onEvent.addListener(debuggerEventListener);
    
    // Set global state
    isDebugging = true;
    attachedTabId = tabId;
    
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
  
  // Check if this is a network event
  if (!message.startsWith('Network.')) {
    return;
  }
  
  // Process different network events
  switch (message) {
    case 'Network.requestWillBeSent':
      handleRequestWillBeSent(params);
      break;
    case 'Network.responseReceived':
      handleResponseReceived(params);
      break;
    case 'Network.loadingFinished':
      handleLoadingFinished(params);
      break;
    case 'Network.loadingFailed':
      handleLoadingFailed(params);
      break;
  }
}

// Handle request being sent
function handleRequestWillBeSent(params) {
  const { requestId, request, type } = params;
  const { url, method, headers, postData } = request;
  
  // Check if URL matches any of our patterns
  if (!shouldInterceptUrl(url)) {
    return;
  }
  
  console.log(`🔵 REQUEST INTERCEPTED (${method}): ${url}`);
  console.log('Request ID:', requestId);
  console.log('Resource Type:', type);
  console.log('Headers:', headers);
  
  if (postData) {
    console.log('Post Data:', postData);
  }
  
  // Example of how to modify a request (commented out by default)
  /*
  if (attachedTabId !== null) {
    // Example: Add a custom header to the request
    const modifiedHeaders = { ...headers, 'X-Modified-By': 'Network-Interceptor' };
    
    chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      'Network.setExtraHTTPHeaders',
      { headers: modifiedHeaders },
      () => {
        console.log('Modified request headers');
      }
    );
    
    // For POST requests, you could modify the post data
    if (postData && method === 'POST') {
      // This is just an example and would need to be customized for your specific needs
      // Note: This approach has limitations and may not work for all requests
      const modifiedPostData = postData; // Modify as needed
      
      // You would need to implement request interception for this to work properly
      console.log('Original POST data:', postData);
      console.log('Modified POST data would be:', modifiedPostData);
    }
  }
  */
  
  console.log('⚠️ MODIFICATION POINT: You can modify the request here before it\'s sent');
  console.log('---------------------------------------------------');
}

// Handle response received
function handleResponseReceived(params) {
  const { requestId, response, type } = params;
  const { url, status, statusText, headers, mimeType } = response;
  
  // Check if URL matches any of our patterns
  if (!shouldInterceptUrl(url)) {
    return;
  }
  
  console.log(`🟢 RESPONSE RECEIVED (${status} ${statusText}): ${url}`);
  console.log('Request ID:', requestId);
  console.log('Resource Type:', type);
  console.log('MIME Type:', mimeType);
  console.log('Headers:', headers);
  
  // Store basic response info immediately
  pendingResponses[requestId] = {
    url,
    status,
    statusText,
    headers,
    mimeType,
    type,
    timestamp: Date.now(),
    body: null,
    isWaiting: true
  };
  
  // Notify popup about new pending response
  chrome.runtime.sendMessage({
    action: 'newPendingResponse',
    requestId,
    url,
    status,
    statusText,
    type,
    mimeType
  });
  
  // Get response body if it's a text-based content type
  if (isTextBasedContent(mimeType) && attachedTabId !== null) {
    chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      'Network.getResponseBody',
      { requestId },
      (response) => {
        if (response && response.body) {
          console.log('Response Body:', response.body.substring(0, 500) + (response.body.length > 500 ? '...' : ''));
          
          // Store the response body
          if (pendingResponses[requestId]) {
            pendingResponses[requestId].body = response.body;
            
            // Notify popup that body is now available
            chrome.runtime.sendMessage({
              action: 'responseBodyReady',
              requestId,
              body: response.body
            });
          }
        }
      }
    );
  }
  
  console.log('⚠️ MODIFICATION POINT: Response is now pending user approval');
  console.log('---------------------------------------------------');
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

// Handle loading finished
function handleLoadingFinished(params) {
  const { requestId, encodedDataLength } = params;
  
  // We don't have the URL here, so we can't filter by pattern
  // But we can log for debugging purposes
  console.log(`🟣 Loading finished for request ${requestId}`);
  console.log('Encoded Data Length:', encodedDataLength);
  console.log('---------------------------------------------------');
}

// Handle loading failed
function handleLoadingFailed(params) {
  const { requestId, errorText, canceled } = params;
  
  console.log(`🔴 Loading failed for request ${requestId}`);
  console.log('Error:', errorText);
  console.log('Canceled:', canceled);
  console.log('---------------------------------------------------');
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
