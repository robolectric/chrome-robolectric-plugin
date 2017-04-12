function RoboBackground() {
    this.urlBase = 'https://localhost:8080';
}

RoboBackground.prototype.getJson = function (url, onLoadFn) {
    console.log('GET', this.urlBase + url);
    var xhr = new XMLHttpRequest();
    xhr.open("GET", this.urlBase + url, true);
    xhr.responseType = 'json';
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            onLoadFn(xhr.response);
        }
    };
    xhr.send();
};

// this.document.xian_GM_xmlhttpRequest({
//     method: 'GET',
//     url: url,
//     responseType: 'json',
//     onload: function (response) {
//         console.log('GET', url, response.readyState, response);
//         onLoadFn(response.response);
//         document.theJson = response;
//     }
// });

RoboBackground.prototype.onMessage = function (request, callback) {
    switch (request.command) {
        case 'getJavadoc':
            this.getJson('/assets/json-docs/' + request.args + '.json', callback);
            break;

        case 'getCtsResults':
            this.getJson('/cts-results.json', callback);
            break;

    }
};

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
