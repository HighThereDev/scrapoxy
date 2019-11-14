'use strict';

const Promise = require('bluebird'),
    request = require('request'),
    winston = require('winston');


module.exports = {
    secure,
    secureRetry,
    waitSecure,
};


////////////

function secure(options) {
    if (!options || !options.hostname || !options.port) {
        return Promise.reject(new Error('[secure] should have hostname and port'));
    }

    winston.debug('[Securer] secure: hostname=%s / port=%d', options.hostname, options.port);

    const opts = {
        method: 'GET',
        url: `http://${options.hostname}:${options.port}/secure`,
        timeout: options.timeout || 5000, // Set default timeout to 5s
    };

    return new Promise((resolve, reject) => {
        request(opts, (err, res, body) => {
            if (err) {
                return reject(err);
            }

            if (res.statusCode !== 200) {
                return reject(body);
            }

            return resolve(body);
        });
    });
}


function secureRetry(options, retry, retryDelay) {
    if (!options || !options.hostname || !options.port || !retryDelay) {
        throw new Error('[secureRetry] should have hostname, port, retry and retryDelay');
    }

    retry = retry || 0;

    winston.debug('[Securer] secureRetry: hostname=%s / port=%d / retry=%d / retryDelay=%d', options.hostname, options.port, retry, retryDelay);

    return secure(options)
        .catch((err) => {
            if (retry > 0) {
                return Promise
                    .delay(retryDelay)
                    .then(() => secureRetry(options, retry - 1, retryDelay));
            }

            throw err;
        });
}

function waitSecure(options, retryDelay, timeout) {
    if (!options || !options.hostname || !options.port || !retryDelay) {
        throw new Error('[Securer] waitSecure: should have hostname, port and retryDelay');
    }

    winston.debug('[Securer] waitSecure: hostname=%s / port=%d / timeout=%d / retryDelay=%d', options.hostname, options.port, timeout, retryDelay);

    const start = new Date().getTime();

    return secureImpl();


    ////////////

    function secureImpl() {
        winston.debug('[Securer] waitSecure: try %s:%d', options.hostname, options.port);

        return secure(options)
            .catch((err) => {
                const end = new Date().getTime();

                if (timeout &&
                    end - start > timeout) {
                    throw err;
                }

                return Promise
                    .delay(retryDelay)
                    .then(() => secureImpl());
            });
    }
}
