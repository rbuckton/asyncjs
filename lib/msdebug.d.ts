/*! *****************************************************************************
Copyright (C) Ron A. Buckton. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use 
this file except in compliance with the License. You may obtain a copy of the 
License at http://www.apache.org/licenses/LICENSE-2.0 

Unless required by applicable law or agreed to in writing, software 
distributed under the License is distributed on an "AS IS" BASIS, 
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 

See the License for the specific language governing permissions and 
limitations under the License. 
***************************************************************************** */
/**
 * IE11 Debug object
 */
declare module Debug {
    function msTraceAsyncOperationStarting(operationName?: string): number;
    function msTraceAsyncCallbackStarting(asyncOperationId: number): void;
    function msTraceAsyncCallbackCompleted(): void;
    function msTraceAsyncOperationCompleted(asyncOperationId: number, status?: number): void;
    function msUpdateAsyncCallbackRelation(relatedAsyncOperationId: number, relationType?: number): void;
    function write(...args: any[]): void;
    function writeln(...args: any[]): void;
    var debuggerEnabled: boolean;
    var setNonUserCodeExceptions: boolean;
    var MS_ASYNC_OP_STATUS_SUCCESS: number;
    var MS_ASYNC_OP_STATUS_CANCELED: number;
    var MS_ASYNC_OP_STATUS_ERROR: number;
    var MS_ASYNC_CALLBACK_STATUS_ASSIGN_DELEGATE: number;
    var MS_ASYNC_CALLBACK_STATUS_JOIN: number;
    var MS_ASYNC_CALLBACK_STATUS_CHOOSEANY: number;
    var MS_ASYNC_CALLBACK_STATUS_CANCEL: number;
    var MS_ASYNC_CALLBACK_STATUS_ERROR: number;
}