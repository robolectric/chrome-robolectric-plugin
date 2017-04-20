describe("Javadoc", function() {
  describe('with a typical method', function() {
    var methodJavadoc;

    beforeEach(function() {
      methodJavadoc = new MethodJavadoc('getContentObservers(android.net.Uri)', {
        "isImplementation": false,
        "modifiers": ["public", "synchronized"],
        "documentation": "Returns the content observers registered with the given {@link android.net.Uri}.\n\nWill be empty if no observer is registered.\n\n@param uri Given URI\n@return The content observers, or null.",
        "params": ["uri"],
        "returnType": "java.util.Collection\u003candroid.database.ContentObserver\u003e",
        "exceptions": [],
        "name": "getContentObservers(android.net.Uri)"
      }, new Javadoc());
    });

    it("returns summary paragraph", function() {
      expect(methodJavadoc.summary())
          .toEqual('Returns the content observers registered with the given [Uri](/reference/android/net/Uri.html "android.net.Uri").');
    });

    it("returns the body", function() {
      expect(methodJavadoc.body())
          .toEqual("Returns the content observers registered with the given [Uri](/reference/android/net/Uri.html \"android.net.Uri\").\n\n" +
              "Will be empty if no observer is registered.\n"
          );
    });

    it("returns all tags", function() {
      expect(methodJavadoc.tags()).toEqual([
        '@param uri Given URI',
        '@return The content observers, or null.'
      ]);
    });

    describe("processTags", function() {
      it("converts {@code}", function() {
        expect(methodJavadoc.processTags("Code goes {@code here}."))
            .toEqual("Code goes `here`.")
      });

      it("converts {@link}", function() {
        expect(methodJavadoc.processTags("Links like {@link java.lang.String}."))
            .toEqual("Links like [String](/reference/java/lang/String.html \"java.lang.String\").");

        expect(methodJavadoc.processTags("Links like {@link java.lang.String#toEqual(java.lang.Object)}."))
            .toEqual("Links like [toEqual(Object)](/reference/java/lang/String.html#toEqual(java.lang.Object) \"java.lang.String#toEqual(java.lang.Object)\").");

        expect(methodJavadoc.processTags("Links like {@link java.lang.String#toEqual(java.lang.Object) but display this}."))
            .toEqual("Links like [but display this](/reference/java/lang/String.html#toEqual(java.lang.Object) \"java.lang.String#toEqual(java.lang.Object)\").");

        expect(methodJavadoc.processTags("Links like {@link String#toEqual(java.lang.Object)}."))
            .toEqual("Links like [toEqual(Object)](/reference/java/lang/String.html#toEqual(java.lang.Object) \"java.lang.String#toEqual(java.lang.Object)\").");

        expect(methodJavadoc.processTags("Links like {@link String#toEqual(Object)}."))
            .toEqual("Links like [toEqual(Object)](/reference/java/lang/String.html#toEqual(java.lang.Object) \"java.lang.String#toEqual(java.lang.Object)\").");

        expect(methodJavadoc.processTags("Links like {@link #toEqual(java.lang.Object)}."))
            .toEqual("Links like [toEqual(Object)](#toEqual(java.lang.Object) \"toEqual(java.lang.Object)\").");

        expect(methodJavadoc.processTags("Links like {@link #toEqual(java.lang.Object) but display this}."))
            .toEqual("Links like [but display this](#toEqual(java.lang.Object) \"toEqual(java.lang.Object)\").");

        expect(methodJavadoc.processTags("Links like {@link java.lang.String but display this}."))
            .toEqual("Links like [but display this](/reference/java/lang/String.html \"java.lang.String\").");

      });
    });

    describe("urlFor", function() {
      it("resolves class names against imports", function() {
        var javadoc = new Javadoc();
        javadoc.imports['Robolectric'] = 'org.robolectric.Robolectric';
        javadoc.imports['ContentProvider'] = 'android.content.ContentProvider';
        javadoc.imports['Uri'] = 'android.net.Uri';

        expect(javadoc.urlFor(javadoc.expandClass('String')))
            .toEqual('/reference/java/lang/String.html');

        expect(javadoc.urlFor(javadoc.expandClass('String'), 'toString()'))
            .toEqual('/reference/java/lang/String.html#toString()');

        expect(javadoc.urlFor(null, 'toString()'))
            .toEqual('#toString()');

        expect(javadoc.urlFor('java.lang.String'))
            .toEqual('/reference/java/lang/String.html');

        expect(javadoc.urlFor(javadoc.expandClass('Robolectric')))
            .toEqual('http://robolectric.org/javadoc/latest/org/robolectric/Robolectric.html');

        expect(javadoc.urlFor('org.robolectric.Robolectric'))
            .toEqual('http://robolectric.org/javadoc/latest/org/robolectric/Robolectric.html');

        expect(javadoc.urlFor('any.other.Robolectric'))
            .toEqual('/reference/any/other/Robolectric.html');

        expect(javadoc.urlFor(javadoc.expandClass('List')))
            .toEqual('/reference/List.html');

        expect(javadoc.urlFor(javadoc.expandClass('ContentProvider'), javadoc.expandMethodSignature('delete(Uri, String, String[])')))
            .toEqual('/reference/android/content/ContentProvider.html#delete(android.net.Uri, java.lang.String, java.lang.String[])');
      });
    });

    describe("processTags", function() {
      it("", function() {

      });
    });
  })
});