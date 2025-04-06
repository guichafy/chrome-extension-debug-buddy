// Global variables
let isDebugging = false;
let attachedTabId = null;
let urlPatterns = [];

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
});

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
  
  // Get response body if it's a text-based content type
  if (isTextBasedContent(mimeType) && attachedTabId !== null) {
    chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      'Network.getResponseBody',
      { requestId },
      (response) => {
        if (response && response.body) {
          console.log('Response Body:', response.body.substring(0, 500) + (response.body.length > 500 ? '...' : ''));
          
          // Example of how to modify a response (commented out by default)
          /*
          // This is just an example and would need to be customized for your specific needs
          if (url.includes('api/data') && mimeType.includes('application/json')) {
            try {
              // Parse the JSON response
              const jsonData = JSON.parse(response.body);
              
              // Modify the data as needed
              jsonData.modified = true;
              jsonData.timestamp = new Date().toISOString();
              
              // Convert back to string
              const modifiedBody = JSON.stringify(jsonData);
              
              // Set the modified response
              chrome.debugger.sendCommand(
                { tabId: attachedTabId },
                'Network.setResponseBody',
                {
                  requestId: requestId,
                  body: modifiedBody
                },
                () => {
                  console.log('Modified response body');
                }
              );
            } catch (error) {
              console.error('Error modifying response:', error);
            }
          }
          */
        }
      }
    );
  }
  
  console.log('⚠️ MODIFICATION POINT: You can modify the response here before it\'s processed by the browser');
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
