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
      expect(methodJavadoc.summary()).toEqual('Returns the content observers registered with the given <a href="/reference/android/net/Uri.html">Uri</a>.');
    });

    it("returns all paragraphs", function() {
      expect(methodJavadoc.paragraphs()).toEqual([
        'Returns the content observers registered with the given <a href="/reference/android/net/Uri.html">Uri</a>.',
        'Will be empty if no observer is registered.'
      ]);
    });

    it("returns all tags", function() {
      expect(methodJavadoc.tags()).toEqual([
        '@param uri Given URI',
        '@return The content observers, or null.'
      ]);
    });

    describe("urlFor", function() {
      it("resolves class names against imports", function() {
        var javadoc = new Javadoc();
        javadoc.imports['Robolectric'] = 'org.robolectric.Robolectric';
        javadoc.imports['ContentProvider'] = 'android.content.ContentProvider';
        javadoc.imports['Uri'] = 'android.net.Uri';

        expect(javadoc.urlFor('String'))
            .toEqual('/reference/java/lang/String.html');

        expect(javadoc.urlFor('java.lang.String'))
            .toEqual('/reference/java/lang/String.html');

        expect(javadoc.urlFor('Robolectric'))
            .toEqual('http://robolectric.org/javadoc/latest/org/robolectric/Robolectric.html');

        expect(javadoc.urlFor('org.robolectric.Robolectric'))
            .toEqual('http://robolectric.org/javadoc/latest/org/robolectric/Robolectric.html');

        expect(javadoc.urlFor('any.other.Robolectric'))
            .toEqual('/reference/any/other/Robolectric.html');

        expect(javadoc.urlFor('List'))
            .toEqual('/reference/List.html');

        expect(javadoc.urlFor('ContentProvider#delete(Uri, String, String[])'))
            .toEqual('/reference/android/content/ContentProvider.html#delete(android.net.Uri, java.lang.String, java.lang.String[])');
      });
    });

    describe("processTags", function() {
      it("", function() {

      });
    });
  })
});