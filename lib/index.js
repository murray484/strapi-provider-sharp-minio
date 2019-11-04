'use strict'

/**
 * Module dependencies
 */

 // Public node modules
const Sharp = require('sharp');
const {URL} = require('url');
const MinioSDK = require('minio');

module.exports = {
  provider: 'sharpminio',
  name: 'Sharp - Minio',
  auth: {
    public: {
      label: 'Access API Token',
      type: 'text',
    },
    private: {
      label: 'Secret Access Token',
      type: 'text',
    },
    bucket: {
      label: 'Bucket',
      type: 'text',
    },
    internalEndpoint: {
      label: 'Internal Endpoint',
      type: 'text',
    },
    externalEndpoint: {
      label: 'External Endpoint',
      type: 'text',
    },
  },
  init: (config) => {
    const internalEndpoint = new URL(config.internalEndpoint);
    const externalEndpoint = new URL(config.externalEndpoint);
    const useSSL = internalEndpoint.protocol && internalEndpoint.protocol.includes('https');

    const externalEndpointProtocol = externalEndpoint.protocol;

   console.log({
     protocol: internalEndpoint.protocol,
      endPoint: internalEndpoint.hostname,
      port: parseInt(internalEndpoint.port) || (useSSL ? 443 : 80),
      useSSL: useSSL,
      accessKey: config.public,
      secretKey: config.private,
    });
   
    const Minio = new MinioSDK.Client({
      endPoint: internalEndpoint.hostname,
      port: parseInt(internalEndpoint.port) || (useSSL ? 443 : 80),
      useSSL: useSSL,
      accessKey: config.public,
      secretKey: config.private,
    });

    return {
      upload: (file) => {
        return new Promise((resolve, reject) => {
          const path = file.path ? `${file.path}/` : '';
          

          Sharp(file.buffer)
            .toFormat('jpeg')
            .jpeg({quality: 90, progressive: true})
            .resize(1920, null)
            .toBuffer()
            .then(buffer => {
              var params = {
                'Content-Type': file.mime,
              };
              let filename = `${path}l_${file.hash}.jpeg`;
              Minio.putObject(config.bucket, filename, buffer, params, (err, tag) => {
                if(err) {
                  reject(err);
                }
                file.url = `${externalEndpointProtocol}//${externalEndpoint.hostname}/${config.bucket}/${filename}`;
                
                // resize again
                Sharp(buffer)
                  .toFormat('jpeg')
                  .jpeg({ quality: 90, progressive: true})
                  .resize(300,300)
                  .toBuffer()
                  .then((buffer) => {
                    var params = {
                      'Content-Type': file.mime,
                    };
                    let filename = `${path}t_${file.hash}.jpeg`;
                    Minio.putObject(config.bucket, filename, buffer, params, (err, tag) => {
                      if(err) {
                        reject(err);
                      }
                      file.thumb = `${externalEndpointProtocol}//${externalEndpoint.hostname}/${config.bucket}/${filename}`;
                      resolve();
                    });
                  })
                  .catch((err) => reject(err));
              });
            })
            .catch((err) => reject(err));
        });
      },
      delete: file => {
        return new Promise((resolve, reject) => {
          const path = file.path ? `${file.path}/` : '';
          let filenameT = `${path}t_${file.hash}.jpeg`;
          let filenameL = `${path}l_${file.hash}.jpeg`;

          Minio.removeObjects(config.bucket, [filenameT, filenameL], (err) => {
            if(err){
              reject(err);
            }
            resolve();
          });
        });
      },
    };
  },
};
