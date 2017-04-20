describe("RoboPage", function() {
  var roboPage;

  beforeEach(function() {
    roboPage = new RoboPage();
  });

  describe("#extractSignature", function() {
    it("should determine package names from anchor hrefs", function() {
      expect(roboPage.extractSignature(
          'void open (<a href="https://developer.android.com/reference/android/net/Uri.html">Uri</a> uri)'))
          .toEqual('open(android.net.Uri)');
    });

    it("should retain array types", function() {
      expect(roboPage.extractSignature(
          'int update (<a href="https://developer.android.com/reference/android/net/Uri.html">Uri</a> uri,\
          <a href="https://developer.android.com/reference/android/content/ContentValues.html">ContentValues</a> values,\
          <a href="https://developer.android.com/reference/java/lang/String.html">String</a> where,\
          <a href="https://developer.android.com/reference/java/lang/String.html">String[]</a> selectionArgs)'))
          .toEqual('update(android.net.Uri,android.content.ContentValues,java.lang.String,java.lang.String[])');
    });

    it("should extract generic types", function() {
      expect(roboPage.extractSignature(
          '<a href="https://developer.android.com/reference/android/content/ContentProviderResult.html">ContentProviderResult[]</a> applyBatch (<a href="https://developer.android.com/reference/java/lang/String.html">String</a> authority, \
          <a href="https://developer.android.com/reference/java/util/ArrayList.html">ArrayList</a>&lt;<a href="https://developer.android.com/reference/android/content/ContentProviderOperation.html">ContentProviderOperation</a>&gt; operations)'))
          .toEqual('applyBatch(java.lang.String,java.util.ArrayList<android.content.ContentProviderOperation>)');
    });
  });

  describe("#prettyClassNames", function() {
    it("should shorten and linkify class names", function() {
      expect(roboPage.prettyClassNames('java.util.List'))
          .toEqual([
            ['java.util.List', 'List', []]
          ]);
    });

    it("should shorten and linkify generics within class names", function() {
      expect(roboPage.prettyClassNames('java.util.List<org.robolectric.shadows.ShadowContentResolver.DeleteStatement>'))
          .toEqual([
            ['java.util.List', 'List', [
              ['org.robolectric.shadows.ShadowContentResolver.DeleteStatement', 'DeleteStatement', []]
            ]]
          ]);
    });

    it("should handle nested generics", function() {
      expect(roboPage.prettyClassNames('java.util.List<java.util.Map<java.lang.String, java.lang.Integer>'))
          .toEqual([
            ['java.util.List', 'List', [
              ['java.util.Map', 'Map', [
                ['java.lang.String', 'String', []],
                ['java.lang.Integer', 'Integer', []]
              ]]
            ]]
          ]);
    });

    it("should handle params", function() {
      expect(roboPage.prettyClassNames('int, java.lang.String, boolean'))
          .toEqual([
            ['int', 'int', []],
            ['java.lang.String', 'String', []],
            ['boolean', 'boolean', []]
          ]);
    });

    it("should handle params with generics", function() {
      expect(roboPage.prettyClassNames('java.util.List<java.util.Map<java.lang.String,java.lang.Integer>>, int'))
          .toEqual([
            ['java.util.List', 'List', [
              ['java.util.Map', 'Map', [
                ['java.lang.String', 'String', []],
                ['java.lang.Integer', 'Integer', []]
              ]]
            ]],
            ['int', 'int', []]
          ]);
    });
  });

  describe("#domClassNames", function() {
    it("should read correctly", function() {
      var dom = roboPage.domClassNames('java.util.List<java.util.Map<java.lang.String,java.lang.Integer>>, int');
      expect(dom.innerText).toEqual("List<Map<String, Integer>>, int");
    });

    it("should insert param names if given", function() {
      var dom = roboPage.domClassNames('java.util.List<java.util.Map<java.lang.String,java.lang.Integer>>, int', ['things', 'count']);
      expect(dom.innerText).toEqual("List<Map<String, Integer>> things, int count");
    });

    it("should have correct links", function() {
      var dom = roboPage.domClassNames('java.util.List<java.util.Map<java.lang.String,java.lang.Integer>>, int');
      expect(dom.innerHTML).toEqual('<a href="/reference/java/util/List.html">List</a>&lt;<a href="/reference/java/util/Map.html">Map</a>&lt;<a href="/reference/java/lang/String.html">String</a>, <a href="/reference/java/lang/Integer.html">Integer</a>&gt;&gt;, int');
    });

    it("should have correct Robolectric links", function() {
      var dom = roboPage.domClassNames('java.util.List<org.robolectric.shadows.ShadowContentResolver>');
      expect(dom.innerHTML).toEqual('<a href="/reference/java/util/List.html">List</a>&lt;<a href="http://robolectric.org/javadoc/latest/org/robolectric/shadows/ShadowContentResolver.html">ShadowContentResolver</a>&gt;');
    });
  });
});
