'use strict';

const EventEmitter = require('events');
const UniqueID = require('@liqd-js/unique-id');
const TimedPromise = require('@liqd-js/timed-promise');

const ARR = ( arr ) => Array.isArray( arr ) ? arr : [ arr ];
const NOOP = () => undefined;

module.exports = class Client_JSONRPC extends EventEmitter
{
    #client;
    #options;
    #url; 
    #iterator = new UniqueID({ node: false, pid: false });
    #calls = new Map();

    constructor( client, options = {})
    {
        super();

        this.#options = options;

        if( typeof client === 'string' )
        {
            this.#url = client;

            this._connect();
        }
        else
        {
            ( this.#client = client ).on( 'message', message => this._handle_message( message ));
        }
    }

    _connect()
    {
        this.#client = new (require('@liqd-js/websocket').Client)( this.#url, this.#options );

        this.#client.on( 'open', () =>
        {
            this.#client.on( 'message', message => this._handle_message( message ));
        });

        this.#client.on( 'close', () => setTimeout( this._connect.bind( this ), 100 ));
        this.#client.on( 'error', NOOP );
    }

    _handle_message( message )
    {
        if( typeof message === 'string' ){ message = JSON.parse( message )}

        if( message.hasOwnProperty('id') )
        {
            if( message.hasOwnProperty('method') )
            {
                let { jsonrpc, id, method, params, ...extensions } = message;

                this.emit( 'call', { id, method, params, extensions });
            }
            else
            {
                let call = this.#calls.get( message.id );

                if( call )
                {
                    this.#calls.delete( message.id );

                    let { jsonrpc, id, error, result, ...extensions } = message;

                    message.hasOwnProperty('error') ? call.reject({ ...error, extensions }) : call.resolve({ result, extensions });
                }
            }
        }
        else if( message.hasOwnProperty('method') )
        {
            let { jsonrpc, method, params, extensions } = message;

            this.emit( 'event', { name: method, data: params, extensions });
        }
    }

    _send( message )
    {
        if( this.#client && this.#client.status === this.#client.constructor.Status.OPEN )
        {
            this.#client.send( JSON.stringify( message ));
        }
        else
        {
            setTimeout(() => this._send( message ), 100 );
        }
    }

    call( method, params, extensions = {})
    {
        return new TimedPromise(( resolve, reject, timeout ) =>
        {
            let id = this.#iterator.get();

            this.#calls.set( id, { resolve, reject }); //timeout

            this._send({ jsonrpc: '2.0', id, method, params: ARR( params ), ...extensions });
        });
    }

    event( event, data, extensions = {})
    {
        this._send({ jsonrpc: '2.0', method: event, params: ARR( data ), ...extensions });
    }

    result( id, result, extensions = {})
    {
        this._send({ jsonrpc: '2.0', id, result, ...extensions });
    }
    
    error( id, error, extensions = {})
    {
        this._send({ jsonrpc: '2.0', id, error, ...extensions });
    }

    close()
    {
        this.#client.close();
    }
}