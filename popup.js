document.addEventListener('DOMContentLoaded', function() {
  // DOM elements - Settings tab
  const urlPatternInput = document.getElementById('urlPattern');
  const addUrlButton = document.getElementById('addUrl');
  const urlList = document.getElementById('urlList');
  const startDebuggingButton = document.getElementById('startDebugging');
  const stopDebuggingButton = document.getElementById('stopDebugging');
  const statusElement = document.getElementById('status');
  
  // DOM elements - Tabs
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // DOM elements - Responses tab
  const pendingResponsesList = document.getElementById('pendingResponsesList');
  const responseDetails = document.getElementById('responseDetails');
  const responseUrl = document.getElementById('responseUrl');
  const responseType = document.getElementById('responseType');
  const responseMimeType = document.getElementById('responseMimeType');
  const responseStatus = document.getElementById('responseStatus');
  const responseHeaders = document.getElementById('responseHeaders');
  const responseBody = document.getElementById('responseBody');
  const approveResponseButton = document.getElementById('approveResponse');
  const cancelEditButton = document.getElementById('cancelEdit');
  
  // Current state
  let currentRequestId = null;
  let pendingResponses = {};
  
  // Load saved URL patterns
  loadUrlPatterns();
  
  // Check debugging status
  checkDebuggingStatus();
  
  // Event listeners - Settings tab
  addUrlButton.addEventListener('click', addUrlPattern);
  startDebuggingButton.addEventListener('click', startDebugging);
  stopDebuggingButton.addEventListener('click', stopDebugging);
  
  // Event listeners - Tabs
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      switchTab(tabName);
      
      // If switching to responses tab, refresh the list
      if (tabName === 'responses') {
        loadPendingResponses();
      }
    });
  });
  
  // Event listeners - Responses tab
  approveResponseButton.addEventListener('click', approveResponse);
  cancelEditButton.addEventListener('click', hideResponseDetails);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'newPendingResponse') {
      // Add to pending responses
      pendingResponses[message.requestId] = {
        url: message.url,
        status: message.status,
        statusText: message.statusText,
        type: message.type,
        mimeType: message.mimeType,
        body: null,
        headers: null,
        timestamp: Date.now()
      };
      
      // Update UI if on responses tab
      if (document.getElementById('responses').classList.contains('active')) {
        updatePendingResponsesList();
      }
    }
    else if (message.action === 'responseBodyReady') {
      // Update body in pending responses
      if (pendingResponses[message.requestId]) {
        pendingResponses[message.requestId].body = message.body;
        
        // Update UI if this response is currently being viewed
        if (currentRequestId === message.requestId) {
          responseBody.value = message.body;
        }
      }
    }
  });
  
  // Tab switching
  function switchTab(tabName) {
    // Update tab buttons
    tabButtons.forEach(button => {
      if (button.getAttribute('data-tab') === tabName) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Update tab contents
    tabContents.forEach(content => {
      if (content.id === tabName) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }
  
  // Add URL pattern to the list
  function addUrlPattern() {
    const urlPattern = urlPatternInput.value.trim();
    
    if (!urlPattern) {
      alert('Please enter a URL pattern');
      return;
    }
    
    // Get existing patterns
    chrome.storage.local.get(['urlPatterns'], function(result) {
      const patterns = result.urlPatterns || [];
      
      // Check if pattern already exists
      if (patterns.includes(urlPattern)) {
        alert('This URL pattern is already in the list');
        return;
      }
      
      // Add new pattern
      patterns.push(urlPattern);
      
      // Save updated patterns
      chrome.storage.local.set({ urlPatterns: patterns }, function() {
        // Clear input
        urlPatternInput.value = '';
        
        // Refresh the list
        loadUrlPatterns();
      });
    });
  }
  
  // Load URL patterns from storage
  function loadUrlPatterns() {
    chrome.storage.local.get(['urlPatterns'], function(result) {
      const patterns = result.urlPatterns || [];
      
      // Clear current list
      urlList.innerHTML = '';
      
      // Add each pattern to the list
      patterns.forEach(function(pattern) {
        const li = document.createElement('li');
        
        const patternText = document.createElement('span');
        patternText.textContent = pattern;
        li.appendChild(patternText);
        
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-url';
        removeButton.addEventListener('click', function() {
          removeUrlPattern(pattern);
        });
        li.appendChild(removeButton);
        
        urlList.appendChild(li);
      });
    });
  }
  
  // Remove URL pattern from the list
  function removeUrlPattern(pattern) {
    chrome.storage.local.get(['urlPatterns'], function(result) {
      let patterns = result.urlPatterns || [];
      
      // Remove the pattern
      patterns = patterns.filter(p => p !== pattern);
      
      // Save updated patterns
      chrome.storage.local.set({ urlPatterns: patterns }, function() {
        // Refresh the list
        loadUrlPatterns();
      });
    });
  }
  
  // Start debugging
  function startDebugging() {
    chrome.runtime.sendMessage({ action: 'startDebugging' }, function(response) {
      if (response && response.success) {
        statusElement.textContent = 'Debugging active';
        statusElement.style.color = '#0f9d58';
      } else {
        statusElement.textContent = 'Failed to start debugging';
        statusElement.style.color = '#db4437';
      }
    });
  }
  
  // Stop debugging
  function stopDebugging() {
    chrome.runtime.sendMessage({ action: 'stopDebugging' }, function(response) {
      if (response && response.success) {
        statusElement.textContent = 'Not debugging';
        statusElement.style.color = '';
        
        // Clear pending responses
        pendingResponses = {};
        updatePendingResponsesList();
        hideResponseDetails();
      } else {
        statusElement.textContent = 'Failed to stop debugging';
        statusElement.style.color = '#db4437';
      }
    });
  }
  
  // Check current debugging status
  function checkDebuggingStatus() {
    chrome.runtime.sendMessage({ action: 'getDebuggingStatus' }, function(response) {
      if (response && response.isDebugging) {
        statusElement.textContent = 'Debugging active';
        statusElement.style.color = '#0f9d58';
      } else {
        statusElement.textContent = 'Not debugging';
        statusElement.style.color = '';
      }
    });
  }
  
  // Load pending responses
  function loadPendingResponses() {
    chrome.runtime.sendMessage({ action: 'getPendingResponses' }, function(response) {
      if (response && response.pendingResponses) {
        pendingResponses = response.pendingResponses;
        updatePendingResponsesList();
      }
    });
  }
  
  // Update the pending responses list in the UI
  function updatePendingResponsesList() {
    // Clear current list
    pendingResponsesList.innerHTML = '';
    
    // Get response IDs and sort by timestamp (newest first)
    const responseIds = Object.keys(pendingResponses);
    
    if (responseIds.length === 0) {
      const noResponses = document.createElement('p');
      noResponses.className = 'no-responses';
      noResponses.textContent = 'No pending responses';
      pendingResponsesList.appendChild(noResponses);
      return;
    }
    
    responseIds.sort((a, b) => {
      return pendingResponses[b].timestamp - pendingResponses[a].timestamp;
    });
    
    // Add each response to the list
    responseIds.forEach(requestId => {
      const response = pendingResponses[requestId];
      
      const responseItem = document.createElement('div');
      responseItem.className = 'response-item';
      responseItem.setAttribute('data-request-id', requestId);
      
      const urlElement = document.createElement('div');
      urlElement.className = 'url';
      urlElement.textContent = response.url;
      responseItem.appendChild(urlElement);
      
      const detailsElement = document.createElement('div');
      detailsElement.className = 'details';
      detailsElement.textContent = `${response.status} ${response.statusText} | ${response.type} | ${response.mimeType}`;
      responseItem.appendChild(detailsElement);
      
      // Add click event to view response details
      responseItem.addEventListener('click', () => {
        viewResponseDetails(requestId);
      });
      
      pendingResponsesList.appendChild(responseItem);
    });
  }
  
  // View response details
  function viewResponseDetails(requestId) {
    currentRequestId = requestId;
    const response = pendingResponses[requestId];
    
    if (!response) {
      alert('Response not found');
      return;
    }
    
    // Get full response details from background script
    chrome.runtime.sendMessage({ 
      action: 'getResponseDetails', 
      requestId 
    }, function(result) {
      if (result && result.success) {
        const fullResponse = result.response;
        
        // Update UI
        responseUrl.textContent = fullResponse.url;
        responseType.textContent = fullResponse.type;
        responseMimeType.textContent = fullResponse.mimeType;
        responseStatus.value = fullResponse.status;
        
        // Format headers as key: value pairs
        let headersText = '';
        for (const [key, value] of Object.entries(fullResponse.headers)) {
          headersText += `${key}: ${value}\n`;
        }
        responseHeaders.value = headersText;
        
        // Set body if available
        responseBody.value = fullResponse.body || 'Loading body...';
        
        // Show response details
        responseDetails.classList.remove('hidden');
      } else {
        alert('Failed to get response details');
      }
    });
  }
  
  // Hide response details
  function hideResponseDetails() {
    responseDetails.classList.add('hidden');
    currentRequestId = null;
  }
  
  // Approve response with modifications
  function approveResponse() {
    if (!currentRequestId) {
      alert('No response selected');
      return;
    }
    
    // Prepare modifications
    const modifications = {
      status: parseInt(responseStatus.value, 10),
      headers: parseHeaders(responseHeaders.value),
      body: responseBody.value
    };
    
    // Send to background script
    chrome.runtime.sendMessage({
      action: 'approveResponse',
      requestId: currentRequestId,
      modifications
    }, function(response) {
      if (response && response.success) {
        // Remove from pending responses
        delete pendingResponses[currentRequestId];
        
        // Update UI
        updatePendingResponsesList();
        hideResponseDetails();
      } else {
        alert('Failed to approve response: ' + (response ? response.error : 'Unknown error'));
      }
    });
  }
  
  // Parse headers from text to object
  function parseHeaders(headersText) {
    const headers = {};
    const lines = headersText.split('\n');
    
    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    });
    
    return headers;
  }
});
