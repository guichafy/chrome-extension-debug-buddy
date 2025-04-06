# Network Request Interceptor Chrome Extension

This Chrome extension allows you to intercept and monitor network requests based on URL patterns. It uses the Chrome Debugger API to intercept both outgoing requests (browser to server) and incoming responses (server to browser).

## Features

- Add URL patterns to intercept
- Monitor requests and responses matching those patterns
- View detailed information about intercepted requests and responses
- Console logging for debugging
- Examples for modifying requests and responses (commented out by default)

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the directory containing this extension
5. The extension should now be installed and visible in your Chrome toolbar

## Usage

1. Click on the extension icon in the Chrome toolbar to open the popup
2. Enter URL patterns you want to intercept (e.g., "example.com", "api/data")
3. Click "Add URL" to add the pattern to the list
4. Click "Start Debugging" to begin intercepting requests
5. Navigate to websites or make requests that match your patterns
6. Open Chrome DevTools Console (F12 or Ctrl+Shift+J) to see the intercepted requests and responses
7. Click "Stop Debugging" when you're done

## Modification Points

The extension includes commented-out examples for modifying requests and responses. To use these features:

1. Open `background.js`
2. Find the commented sections marked with `/* ... */`
3. Uncomment and customize the code to modify requests or responses as needed
4. Reload the extension

### Request Modification Example

```javascript
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
```

### Response Modification Example

```javascript
// Example for JSON responses
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
```

## Limitations

- The extension can only intercept requests in the tab it's attached to
- Some types of requests may not be interceptable
- The extension requires the Debugger API, which has certain limitations
- Response modification may not work for all types of responses

## Permissions

This extension requires the following permissions:

- `debugger`: To intercept and modify network requests
- `tabs`: To attach to the current tab
- `storage`: To store URL patterns

## Development

To modify or extend this extension:

1. Edit the files as needed
2. Reload the extension in `chrome://extensions/` by clicking the refresh icon
3. Test your changes

## License

This project is open source and available for any use.
