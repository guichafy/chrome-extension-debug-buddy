document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const urlPatternInput = document.getElementById('urlPattern');
  const addUrlButton = document.getElementById('addUrl');
  const urlList = document.getElementById('urlList');
  const startDebuggingButton = document.getElementById('startDebugging');
  const stopDebuggingButton = document.getElementById('stopDebugging');
  const statusElement = document.getElementById('status');
  
  // Load saved URL patterns
  loadUrlPatterns();
  
  // Check debugging status
  checkDebuggingStatus();
  
  // Event listeners
  addUrlButton.addEventListener('click', addUrlPattern);
  startDebuggingButton.addEventListener('click', startDebugging);
  stopDebuggingButton.addEventListener('click', stopDebugging);
  
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
});
