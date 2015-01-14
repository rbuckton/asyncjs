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