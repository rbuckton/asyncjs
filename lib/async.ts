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
import promise = require('./promise');
import deferred = require('./deferred');
import cancellation = require('./cancellation');
import utils = require('./utils');

export import IPromise = promise.IPromise;
export import Promise = promise.Promise;
export import Deferred = deferred.Deferred;
export import CancellationToken = cancellation.CancellationToken;
export import CancellationTokenRegistration = cancellation.CancellationTokenRegistration;
export import CancellationTokenSource = cancellation.CancellationTokenSource;
export import sleep = utils.sleep;
export import spin = utils.spin;