'use strict';

const EventEmitter = require('events');
const UniqueID = require('@liqd-js/unique-id');
const TimedPromise = require('@liqd-js/timed-promise');

const NOOP = () => undefined;

module.exports = class Client_JSONRPC extends EventEmitter
{
    #client; 
    #url; 
    #iterator = new UniqueID({ node: false, pid: false });
    #calls = new Map();

    constructor( client, options = {})
    {
        super();

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
        this.#client = new (require('@liqd-js/websocket').Client)( this.#url );

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
                this.emit( 'call', message.id, message.method, message.params );
            }
            else
            {
                let call = this.#calls.get( message.id );

                if( call )
                {
                    this.#calls.delete( message.id );

                    message.hasOwnProperty('error') ? call.reject( message.error ) : call.resolve( message.result );
                }
            }
        }
        else if( message.hasOwnProperty('method') )
        {
            this.emit( 'event', message.method, message.params );
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

    call( method, ...params )
    {
        return new TimedPromise(( resolve, reject, timeout ) =>
        {
            let id = this.#iterator.get();

            this.#calls.set( id, { resolve, reject }); //timeout

            this._send({ jsonrpc: '2.0', id, method, params });
        });
    }

    event( event, ...data )
    {
        this._send({ jsonrpc: '2.0', method: event, params: data });
    }

    result( id, result )
    {
        this._send({ jsonrpc: '2.0', id, result });
    }
    
    error( id, error )
    {
        this._send({ jsonrpc: '2.0', id, error });
    }

    close()
    {
        this.#client.close();
    }
}