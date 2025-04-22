/**
 * Hot reload utility for Chrome extensions
 * This script watches for changes in the extension files and reloads the extension
 */

// Function to reload the extension
const reloadExtension = () => {
  // Send a message to all extension pages to reload
  chrome.runtime.sendMessage({ action: 'hot_reload' });
  
  // Reload the extension itself
  chrome.runtime.reload();
};

// Listen for file change events from the development server
if (process.env.NODE_ENV !== 'production') {
  // Set up a connection to listen for reload messages
  const port = chrome.runtime.connect({ name: 'hot-reload' });
  
  // Listen for reload messages
  port.onMessage.addListener((message) => {
    if (message.action === 'reload_extension') {
      console.log('Hot reload triggered');
      reloadExtension();
    }
  });
  
  console.log('Hot reload initialized');
}

export { reloadExtension };
