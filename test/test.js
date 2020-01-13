const { Server } = require('@liqd-js/websocket');
const Client_JSONRPC = require('../lib/client_jsonrpc.js');

const SLEEP = ( ms ) => new Promise( r => setTimeout( r, ms ));
const NOOP = () => undefined;

const server = new Server({ port: 8080 });

server.on( 'client', client => 
{
    let client_jsonrpc = new Client_JSONRPC( client );

    client_jsonrpc.on( 'call', async ( call ) => 
    {
        console.log( 'call',  call );

        await SLEEP( 1000 );

        client_jsonrpc.result( call.id, call.params[0] + call.params[1] );
    });

    client.on( 'close', NOOP );
    client.on( 'error', NOOP );
});

const client = new Client_JSONRPC('ws://localhost:8080');

client.call( 'sum', [ 1, 2 ] ).then( console.log );
client.call( 'sum', [ 3, 2 ], { foo: 'bar' } ).then( console.log );
client.call( 'sum', [ 4, 3 ] ).then( console.log );