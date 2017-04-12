console.log('start content-script!');

function RoboPage() {
    this.roboHome = 'https://localhost:8080';

    this.background = chrome.runtime.connect();
    this.backgroundCallbacks = {};
    this.nextBackgroundCallback = 0;

    this.background.onMessage.addListener(function (msg) {
        console.log('<--', msg);

        var callback = this.backgroundCallbacks[msg.id];
        delete this.backgroundCallbacks[msg.id];
        callback(msg.response);
    }.bind(this));

    this.isReady = false;
    this._onReadyCallbacks = [];

    this._ctsResults = {};

    this.androidClassName = null;
    this.init();
}

RoboPage.prototype.sendBackgroundMessage = function (command, args, callback) {
    var myId = this.nextBackgroundCallback++;
    this.backgroundCallbacks[myId] = callback;

    var message = {command: command, args: args, id: myId};
    console.log('-->', message);
    this.background.postMessage(message);
};

RoboPage.prototype.html = function (html) {
    var holder = document.createElement('div');
    holder.innerHTML = html;
    return holder.firstElementChild;
};

RoboPage.prototype.getJavadoc = function (className, callback) {
    this.sendBackgroundMessage('getJavadoc', className, callback);
};

RoboPage.prototype.getCtsResults = function (callback) {
    this.sendBackgroundMessage('getCtsResults', [], callback);
};

RoboPage.prototype.init = function () {
    this.roboPanel = this.html('<div style="position: fixed; width: 140px; right: 2em; top: 6em; z-index: 100;"/>');
    this.roboPanel.innerHTML = '<img src="' + this.roboHome + '/images/robolectric-stacked.png" alt="Robolectric" style="opacity: .1;"/>';
    this.whenReady(function () {
        document.body.appendChild(this.roboPanel);
    }.bind(this));

    var roboLogo = this.roboPanel.firstElementChild;

    this.getCtsResults(this.gotCtsResults.bind(this));

    if (document.location.pathname.startsWith('/reference/')) {
        this.androidClassName = document.location.pathname.split('/').slice(2).join('.').replace('.html', '');
    }

    if (this.androidClassName) {
        var className = this.androidClassName;
        this.roboPanel.innerHTML += '<br/>' + className;

        var htmlRE = /<[a]\s+href=['"]([^'"]+)['"]>([^<]+)<\/a>/g;
        var httpRE = /\/reference\/(.+)\.html/;
        var signatureRE = /^([^\s]+)\s+([^\s]+)\s*\(([^)]*)\)/;

        this.getJavadoc(className, function (javaDoc) {
            console.log("ready!");

            this.whenReady(function () {
                document.querySelectorAll('div.api pre.api-signature').forEach(function (node) {
                    var html = node.innerHTML;
                    html = html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(htmlRE, function (full, url, str) {
                        var urlMatch = httpRE.exec(url);
                        return urlMatch[1].replace(/\//g, '.');
                    });
                    var match = signatureRE.exec(html);
                    if (match) {
                        var returnType = match[1];
                        var methodName = match[2];
                        var params = match[3].replace(/\s/g, ' ').split(/,/).map(function (x) {
                            return x.trim().split(/ /)[0];
                        });

                        var signature = methodName + '(' + params.join(',') + ')';

                        var shadowMethodDesc = javaDoc['methods'][signature];
                        console.log(signature, shadowMethodDesc);
                        if (shadowMethodDesc && shadowMethodDesc.documentation) {
                            var memberDiv = node.parentElement;
                            var anchorDiv = memberDiv.previousElementSibling;
                            var newDiv = this.html('<div class="robolectric method"/>');
                            memberDiv.parentElement.insertBefore(newDiv, memberDiv.nextSibling);
                            var docHtml = shadowMethodDesc.documentation.replace(/\{(@[^\s]+)\s+([^}]+)\}/g, function (full, tag, str) {
                                console.log(arguments);
                                switch (tag) {
                                    case '@code':
                                        return '<code>' + str + '</code>';
                                    case '@link':
                                        return '<a href="???">' + str + '</a>';
                                    default:
                                        return full;
                                }
                            });
                            newDiv.innerHTML = "<p><b><i>Robolectric notes:</i></b></p>\n" + docHtml;
                        }
                    }
                }.bind(this));

                console.log(roboLogo);
                roboLogo.style.opacity = '.25';
            }.bind(this));
        }.bind(this));
    }

};

RoboPage.prototype.findCtsResults = function (name) {
    var r = this._ctsResults[name];
    if (r == null) {
        r = this._ctsResults[name] = {pass: 0, fail: 0};
    }
    return r;
};

RoboPage.prototype.gotCtsResults = function (json) {
    console.log("cts results!", json);

    document.ctsResults = json;
    console.log('cts results!1', json);

    var ctsPackageRE = /^(.+)\.cts\.(.+)Test$/;
    Object.keys(json['classes']).forEach(function (ctsTestClassName) {
        var match = ctsPackageRE.exec(ctsTestClassName);
        if (match) {
            var ctsPackageName = match[1];
            var ctsClassName = ctsPackageName + '.' + match[2];

            var ctsAllResults = this.findCtsResults('all');
            var ctsPackageResults = this.findCtsResults(ctsPackageName);
            var ctsClassResults = this.findCtsResults(ctsClassName);

            var methods = json['classes'][ctsTestClassName]['methods'];
            Object.keys(methods).forEach(function (ctsMethodName) {
                switch (methods[ctsMethodName]) {
                    case 'PASS':
                        ctsAllResults.pass++;
                        ctsPackageResults.pass++;
                        ctsClassResults.pass++;
                        break;
                    case 'FAIL':
                    case 'TIMEOUT':
                    case 'DISABLE':
                    default:
                        ctsAllResults.fail++;
                        ctsPackageResults.fail++;
                        ctsClassResults.fail++;
                        break;
                }
            });
        }
    }.bind(this));

    this.whenReady(function () {
        console.log('cts results!2', json);
        console.log('cts results!3', document.ctsResults);

        var results = this._ctsResults[this.androidClassName];
        if (results) {
            var total = results.pass + results.fail;
            this.roboPanel.appendChild(this.html('<div>CTS: ' + results.pass + '/' + total + "</div>"));
        }

        results = this._ctsResults['all'];
        if (results) {
            total = results.pass + results.fail;
            this.roboPanel.appendChild(this.html('<div>All CTS: ' + results.pass + '/' + total + "</div>"));
        }

        document.querySelectorAll('.dac-reference-nav-list li a').forEach(function (node) {
            var anchor = node;
            var text = anchor.innerText.trim();
            var results = this._ctsResults[text];
            if (results) {
                var total = results.pass + results.fail;
                anchor.parentNode.insertBefore(this.html('<div class="cts-results">' + results.pass + '/' + total + '</div>'), anchor.parentNode.firstChild);
            }
        }.bind(this));
    }.bind(this));
};

RoboPage.prototype.whenReady = function (fn) {
    if (this.isReady) {
        fn();
    } else {
        this._onReadyCallbacks.push(fn);
    }
};

RoboPage.prototype.onReady = function () {
    this.isReady = true;
    var callbacks = this._onReadyCallbacks;
    this._onReadyCallbacks = null;
    callbacks.forEach(function (cb) {
        cb();
    });
};

var roboPage = new RoboPage();

chrome.runtime.sendMessage({state: "document-start"}, function (response) {
    console.log("hello response", response);
});

document.addEventListener("DOMContentLoaded", function (event) {
    roboPage.onReady();

    chrome.runtime.sendMessage({state: "document-ready"}, function (response) {
        console.log("ready response", response);
    });
});


console.log("done!");