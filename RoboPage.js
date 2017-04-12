function RoboPage() {
    this.roboHome = 'https://localhost:8080';

    this.isReady = false;
    this._onReadyCallbacks = [];

    this._ctsResults = {};

    this.androidClassName = null;
}

RoboPage.prototype.connectToBackground = function (command, args, callback) {
    this.background = chrome.runtime.connect();
    this.backgroundCallbacks = {};
    this.nextBackgroundCallback = 0;

    this.background.onMessage.addListener(function (msg) {
        console.log('<--', msg);

        var callback = this.backgroundCallbacks[msg.id];
        delete this.backgroundCallbacks[msg.id];
        callback(msg.response);
    }.bind(this));
};

RoboPage.prototype.sendBackgroundMessage = function (command, args, callback) {
    var myId = this.nextBackgroundCallback++;
    this.backgroundCallbacks[myId] = callback;

    var message = {command: command, args: args, id: myId};
    console.log('-->', message);
    this.background.postMessage(message);
};

RoboPage.prototype.html = function (html, innerText) {
    var holder = document.createElement('div');
    holder.innerHTML = html;

    // set innerText of most deeply nested element...
    if (innerText) {
        var node = holder.firstElementChild;
        while (node.firstElementChild) {
            node = node.firstElementChild;
        }
        node.innerText = innerText;
    }

    return holder.firstElementChild;
};

RoboPage.prototype.getJavadoc = function (className, callback) {
    this.sendBackgroundMessage('getJavadoc', className, callback);
};

RoboPage.prototype.getCtsResults = function (callback) {
    this.sendBackgroundMessage('getCtsResults', [], callback);
};

RoboPage.prototype.init = function () {
    this.connectToBackground();

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

        this.getJavadoc(className, function (javaDoc) {
            console.log("ready!");

            this.whenReady(function () {
                this.decorateJavadocPage(javaDoc);
                console.log(roboLogo);
                roboLogo.style.opacity = '.25';
            }.bind(this));
        }.bind(this));
    }
};

RoboPage.htmlRE = /<[a]\s+href=['"]([^'"]+)['"]>([^<]+)<\/a>/g;
RoboPage.httpRE = /\/reference\/(.+)\.html/;
RoboPage.pageSignatureRE = /^([^\s]+)\s+([^\s]+)\s*\(([^)]*)\)/;
RoboPage.jsonSignatureRE = /^([^\s]+)\(([^)]*)\)/;

RoboPage.prototype.decorateJavadocPage = function (javaDoc) {
    // add notes to @Implemented methods...
    document.querySelectorAll('div.api pre.api-signature').forEach(function (node) {
        var html = node.innerHTML;
        html = html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(RoboPage.htmlRE, function (full, url, str) {
            var urlMatch = RoboPage.httpRE.exec(url);
            return urlMatch[1].replace(/\//g, '.');
        });
        var match = RoboPage.pageSignatureRE.exec(html);
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

    var pubMethodsTable = document.getElementById('pubmethods');
    var shadowMethodsTable = this.html('<table class="responsive methods robolectric-shadow"><tbody><tr><th colspan="2"><h3>Shadow methods</h3></th></tr></tbody></table>');
    pubMethodsTable.parentNode.insertBefore(shadowMethodsTable, pubMethodsTable.nextElementSibling);
    Object.keys(javaDoc['methods']).forEach(function (methodSignature) {
        var methodJavadoc = javaDoc['methods'][methodSignature];

        if (methodJavadoc.isImplementation) return;

        var row = document.createElement('tr');
        row.classList.add('api');
        row.classList.add('apilevel-0');
        row.classList.add('shadow');

        var td1 = document.createElement('td');
        row.appendChild(td1);

        var td1Code = document.createElement('code');
        td1.appendChild(td1Code);
        td1Code.appendChild(this.domClassNames(methodJavadoc.returnType));

        var td2 = document.createElement('td');
        td2.setAttribute('width', '100%');
        row.appendChild(td2);

        var td2Code = document.createElement('code');
        var match = RoboPage.jsonSignatureRE.exec(methodSignature);
        td2Code.appendChild(document.createTextNode('shadowOf().' + match[1] + '('));
        td2Code.appendChild(this.domClassNames(match[2]));
        td2Code.appendChild(document.createTextNode(')'));
        td2.appendChild(td2Code);

        if (methodJavadoc.documentation) {
            var p = document.createElement('p');
            p.innerHTML = methodJavadoc.documentation.split(/\n/)[0];
            td2.appendChild(p);
        }

        shadowMethodsTable.firstElementChild.appendChild(row);
    }.bind(this));
};

RoboPage.prototype.domClassNames = function (className) {
    var descs = this.prettyClassNames(className);
    var dom = document.createElement('span');
    for (var i = 0; i < descs.length; i++) {
        var desc = descs[i];
        this.domClassNameRecursive_(desc, dom);
    }
    return dom;
};

RoboPage.prototype.domClassNameRecursive_ = function (classDesc, dom) {
    var anchor = document.createElement('a');
    anchor.href = '/path/to/' + classDesc[0];
    anchor.innerText = classDesc[1];
    dom.appendChild(anchor);

    var generics = classDesc[2];
    if (generics.length > 0) {
        dom.appendChild(document.createTextNode('<'));
        for (var i = 0; i < generics.length; i++) {
            if (i > 0) dom.appendChild(document.createTextNode(', '));

            this.domClassNameRecursive_(generics[i], dom);
        }
        dom.appendChild(document.createTextNode('>'));
    }
};

RoboPage.prototype.prettyClassNames = function (classNames) {
    var code = document.createElement('code');

    var topNode = [null, null, []];
    var curNode = topNode;

    var cur = "";
    var stack = [];

    var chomp = null;
    var l = classNames.length;
    for (var i = 0; i < l; i++) {
        var c = classNames.charAt(i);
        switch (c) {
            case '<':
            case '>':
            case ',':
                chomp = cur;
                cur = "";
                break;

            default:
                cur += c;
        }

        if (chomp == null && i + 1 == l) {
            chomp = cur;
        }

        if (chomp) {
            chomp = chomp.trim();
            var newNode = [chomp, chomp.match(/[^.]+$/)[0], []];
            curNode[2].push(newNode);
            chomp = null;

            switch (c) {
                case '<':
                    stack.push(curNode);
                    curNode = newNode;
                    break;
                case '>':
                    curNode = stack.pop();
                    break;
            }
        }
    }

    return topNode[2];
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
