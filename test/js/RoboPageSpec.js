describe("RoboPage", function () {
    var roboPage;

    beforeEach(function () {
        roboPage = new RoboPage();
    });

    describe("#prettyClassNames", function () {
        it("should shorten and linkify class names", function () {
            expect(roboPage.prettyClassNames('java.util.List'))
                .toEqual([
                    ['java.util.List', 'List', []]
                ]);
        });

        it("should shorten and linkify generics within class names", function () {
            expect(roboPage.prettyClassNames('java.util.List<org.robolectric.shadows.ShadowContentResolver.DeleteStatement>'))
                .toEqual([
                    ['java.util.List', 'List', [
                        ['org.robolectric.shadows.ShadowContentResolver.DeleteStatement', 'DeleteStatement', []]
                    ]]
                ]);
        });

        it("should handle nested generics", function () {
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

        it("should handle params", function () {
            expect(roboPage.prettyClassNames('int, java.lang.String, boolean'))
                .toEqual([
                    ['int', 'int', []],
                    ['java.lang.String', 'String', []],
                    ['boolean', 'boolean', []]
                ]);
        });
    });
});
