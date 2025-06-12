/**
 * Chrome Extension Hot Reload
 *
 * This utility helps with development by reloading the extension when files change.
 * It works by sending a message to all extension pages to reload.
 */

// Function to reload all extension pages
const reloadExtensionPages = () => {
	// Get all extension pages
	chrome.runtime.getBackgroundPage((backgroundPage: any) => {
		if (backgroundPage) {
			// Reload background page
			backgroundPage.location.reload();
		}
	});

	// Send message to all extension pages to reload
	chrome.runtime.sendMessage({ action: 'hot_reload' });
};

// Function to reload the extension
const reloadExtension = () => {
	console.log('Reloading extension...');

	// In development mode, we reload all extension pages
	if (process.env.NODE_ENV !== 'production') {
		reloadExtensionPages();
	}
};

// Listen for reload messages from the development server
if (process.env.NODE_ENV !== 'production') {
	// Set up a connection to listen for reload messages
	console.log('Extension reloader initialized in development mode');

	// Check for changes every 1 second (polling approach)
	let lastUpdateTime = Date.now();

	setInterval(() => {
		// Check if extension files have been updated
		chrome.runtime.getPackageDirectoryEntry((directoryEntry) => {
			directoryEntry.getFile('last-update.json', {}, (fileEntry: any) => {
				fileEntry.file((file: File) => {
					const reader = new FileReader();
					reader.onloadend = () => {
						try {
							const updateInfo = JSON.parse(reader.result as string);
							if (updateInfo.timestamp > lastUpdateTime) {
								lastUpdateTime = updateInfo.timestamp;
								reloadExtension();
							}
						} catch (e) {
							console.error('Error parsing update info:', e);
						}
					};
					reader.readAsText(file);
				});
			});
		});
	}, 1000);
}

export { reloadExtension };
