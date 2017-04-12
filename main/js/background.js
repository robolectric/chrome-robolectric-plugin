var roboBackground = new RoboBackground();

chrome.runtime.onConnect.addListener(function (port) {
    console.log("connection from " + port);
    port.onMessage.addListener(function (msg) {
        console.log('<--', msg);

        roboBackground.onMessage(msg, function(response) {
            var message = {response: response, id: msg.id};
            console.log('-->', message);
            port.postMessage(message);
        });
    });
    return true;
});
