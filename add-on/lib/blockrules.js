/**
 * Code for managing rules for what standards are blocked on which domains.
 */
(function () {
    "use strict";

    // From https://www.npmjs.com/package/escape-string-regexp
    const matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;

    const escapeStringRegexp = aString => {
        if (typeof aString !== "string") {
            throw new TypeError("Expected a string");
        }

        return aString.replace(matchOperatorsRe, "\\$&");
    };

    /**
     * Mapping of string to regular expression objects, to prevent having
     * to repeatedly parse the same match patterns into regular expressions.
     */
    const reCache = new Map();

    /**
     * Compiles a match pattern into a regular expression.
     *
     * This function basically maps the nicer PatternMatch syntax to the
     * more powerful, but uglier, regex syntax.
     *
     * The results of this function are internally cached.
     *
     * This code is mainly adapted from the matcher npm package.
     *
     * @see https://www.npmjs.com/package/matcher
     *
     * @param {MatchPattern} matchPattern
     *   A string describing a set of URLs that should be matched.
     *
     * @return {RegEx}
     *   A regular expresison object that encodes the given match pattern.
     */
    const makeRe = matchPattern => {
        if (reCache.has(matchPattern)) {
            return reCache.get(matchPattern);
        }

        const negated = matchPattern[0] === "!";

        if (negated) {
            matchPattern = matchPattern.slice(1);
        }

        matchPattern = escapeStringRegexp(matchPattern).replace(/\\\*/g, ".*");

        if (negated) {
            matchPattern = `(?!${matchPattern})`;
        }

        const re = new RegExp(`^${matchPattern}$`, "i");
        re.negated = negated;
        reCache.set(matchPattern, re);

        return re;
    };

    /**
     * Tests to see if a match pattern matches a given host name.
     *
     * This function matches slightly more loosely than what is described by
     * mozilla in the given link, since it treats a wildcard as segment
     * as matching urls w/o that segment (e.g. "*.example.com" matches
     * "example.com").
     *
     * @see https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
     *
     * @param {MatchPattern} matchPattern
     *   A match pattern, describing a set of URLs in RegEx like format.
     * @param {string} host
     *   A url to test against the provided pattern.
     *
     * @return {boolean}
     *   Boolean description of whether the given match pattern matches
     *   the host name.
     */
    const testPatternWithHost = (matchPattern, host) => {
        const compiledPattern = makeRe(matchPattern);

        if (compiledPattern.test(host) === true) {
            return true;
        }

        if (matchPattern.startsWith("*.") &&
                matchPattern.endsWith(host) &&
                matchPattern.length === host.length + 2) {
            return true;
        }

        return false;
    };

    /**
     * Tests to see if a match pattern matches a given url.
     *
     * This function matches slightly more loosely than what is described by
     * mozilla in the given link, since it treats a wildcard as segment
     * as matching urls w/o that segment (e.g. "*.example.com" matches
     * "example.com").
     *
     * @see https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
     *
     * @param {MatchPattern} matchPattern
     *   A match pattern, describing a set of URLs in RegEx like format.
     * @param {string} url
     *   A url to test against the provided pattern.
     *
     * @return {boolean}
     *   Boolean description of whether the given match pattern matches
     *   the url.
     */
    const testPatternWithUrl = (matchPattern, url) => {
        const hostName = window.URI.parse(url).host;
        return testPatternWithHost(matchPattern, hostName);
    };

    /**
     * A shorthand, reg-ex like rule for matching domains.
     *
     * @see https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
     *
     * @typedef {string} MatchPattern
     */

    /**
     * An structure that defines which stanards should be blocked on domains.
     *
     * @typedef {object} BlockRule
     * @property {function(): string} toJSON
     *   Returns a serialized version of the data contained in this object,
     *   as a JSON string.
     * @property {function(): object} toData
     *   Returns an object, representing a copy of the data represented by this
     *   object.  This is basically toJSON, but without the serialization step.
     * @property {function(string): boolean} isMatchingUrl
     *   Returns a boolean description of whether this block rule should
     *   be applied to a url.
     * @property {function(string): boolean} isMatchingHost
     *   Returns a boolean description of whether this block rule should
     *   be applied to a host.
     * @property {MatchPattern} pattern
     *   Read only reference to the match pattern this rule applies to.
     * @property {function(): Array.number}
     *   Returns a new array of the standard ids being blocked by this rule.
     * @property {function(Array.number): undefined} setStandardIds
     *   Sets the standard ids that should be blocked by this rule.
     */

    /**
     * Creates a new block rule object, specifying which standards to block
     * on which domains.
     *
     * @param {MatchPattern} matchPattern
     *   A string describing which domains this rule should apply to.
     * @param {Array.number} standardIds
     *   An array of integers, each describing a standard that should be
     *   blocked.
     *
     * @return {BlockRule}
     *   A block rule object, configured to block the given standards on
     *   domains matching the match pattern.
     */
    const init = (matchPattern, standardIds) => {
        let localStandardIds = standardIds.slice() || [];

        const toData = () => {
            return Object.assign({}, {
                p: matchPattern,
                s: localStandardIds.sort((a, b) => (a - b)),
            });
        };

        const toJSON = () => {
            return JSON.stringify(toData());
        };

        const setStandardIds = newStandardIds => {
            localStandardIds = newStandardIds;
        };

        const getStandardIds = () => localStandardIds.slice();

        return Object.freeze({
            toData,
            toJSON,
            setStandardIds,
            getStandardIds,
            pattern: matchPattern,
            isMatchingHost: testPatternWithHost.bind(undefined, matchPattern),
            isMatchingUrl: testPatternWithUrl.bind(undefined, matchPattern),
        });
    };

    /**
     * Initilizes a BlockRule object, based on the data exported from the
     * BlockRule.toData function.
     *
     * @param {object} object
     *   An object generated by `BlockRule.toData`.
     *
     * @return {BlockRule}
     *   An initilized BlockRule object.
     *
     *
     * @throws If the given object is not in the expected fromat, generated by
     *   `BlockRule.toData`.
     */
    const fromData = object => {
        if (object.p === undefined || object.s === undefined) {
            throw `'Data is not a valid BlockRule: expected to find "p" and "s" properties`;
        }

        if (Array.isArray(object.s) === false ||
                object.s.every(value => typeof value === "number") === false) {
            throw `Data is not a valid BlockRule: the "s" property should be an array of standardIds`;
        }

        return init(object.p, object.s);
    };

    /**
     * Initilizes a BlockRule object, based on a serialized version
     * of a BlockRule objects (generated from a call to `BlockRule.toJSON`).
     *
     * @param {string} jsonString
     *   A JSON string generated from `BlockRule.toJSON`.
     *
     * @return {BlockRule}
     *   An initilized BlockRule object.
     *
     * @throws If the given string is not in the expected fromat, generated by
     *   `BlockRule.toJSON`.
     */
    const fromJSON = jsonString => {
        const data = JSON.parse(jsonString);
        return fromData(data);
    };

    window.WEB_API_MANAGER.blockRulesLib = {
        init,
        fromData,
        fromJSON,
    };
}());