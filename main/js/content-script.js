var roboPage = new RoboPage();
roboPage.init();

chrome.runtime.sendMessage({state: "document-start"}, function(response) {
  console.log("hello response", response);
});

document.addEventListener("DOMContentLoaded", function(event) {
  roboPage.onReady();

  chrome.runtime.sendMessage({state: "document-ready"}, function(response) {
    console.log("ready response", response);
  });
});
