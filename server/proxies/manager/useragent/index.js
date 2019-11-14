'use strict';
const UserAgent = require('user-agents');

module.exports = {
    generateBrowser,
};

function generateBrowser() {
    return (new UserAgent()).toString();
}
