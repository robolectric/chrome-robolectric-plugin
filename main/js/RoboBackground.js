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
