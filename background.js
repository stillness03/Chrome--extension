chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.action === "checkVideo") {
    sendResponse({ status: "ready", videoFound: true });
  }

  return true;
});
