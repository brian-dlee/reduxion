import {
  applyMiddleware,
  bindActionCreators,
  combineReducers,
  createStore
} from "redux";

import Reducer from "./reducer";
import StateConnector from "./state-connector";
import { convertDirectoryNotationToObject } from "./utils";

/* ####################################################################
 Publicly exposed functional adapters for Radux components
 ####################################################################### */

/**
 * Functional adapter for Reducer class
 * @param name Name of the reducer - acts as namespace for action types
 * @param initialState - initial state for reducer
 */
const reducer = (name, initialState = {}) => new Reducer(name, initialState);

/**
 * Functional adapter for StateConnector class
 * @param Component React Component to connect Redux state to
 * @param params Object consisting of any of the following: stateFilter, actionCreators, redux "connect" options or mergeProps
 * @return {StateConnector} The resulting StateConnector
 */
const stateConnector = (Component, params) =>
  new StateConnector(Component, params);

/* ####################################################################
 Radux global store storage
 ####################################################################### */

/**
 * Radux global store object
 * @type {{}}
 */
const stores = {};

/* ####################################################################
 Radux global action creator registration
 ####################################################################### */

/**
 * Radux package store for globally registered action creators
 * @type {{}}
 */
let globalActionCreators = {};

/**
 * Register action creators that will register with every radux connected Component
 * @param reducer {Reducer} A Radux reducer
 */
const registerGlobalReducer = reducer =>
  (globalActionCreators = {
    ...globalActionCreators,
    [reducer.name]: reducer.actionCreators
  });

/* ####################################################################
 Radux Reducer registration and retrieval
 ####################################################################### */

/**
 *  * Radux package store for all registered reducers
 * @type {Reducer}
 */
let registeredReducers = {};

/**
 * Register reducer with radux - when getting the combined reducer all registered reducers will be in the result
 * @param name
 * @param reducer
 */
const registerReducer = (name, reducer) => {
  if (!reducer instanceof Reducer) {
    throw `registerReducer must be passed an object of type Reducer. ${type(
      reducer
    )} provided.`;
  }

  registeredReducers = {
    ...registeredReducers,
    ...{ [name]: reducer }
  };
};

/**
 * Bulk reducer registration
 * @param reducers
 */
const registerReducers = reducers =>
  Object.keys(reducers).forEach(r => registerReducer(r, reducers[r]));

/**
 * Adds and returns a store based on all registered reducers
 * @returns {Store<S>}
 * @param storeName {String} Store name
 * @param newReducers {Reducer<S>} Radux or Redux Reducers used to create store
 * @param storeInitialState {{}} Initial state for store
 * @param enhancers {{}} Enhancers (must be accepted by Redux.applyMiddleware)
 */
const addNamedStore = (
  storeName,
  newReducers,
  storeInitialState,
  ...enhancers
) => {
  const reducers = { ...newReducers, ...registeredReducers };

  registerReducers(newReducers);

  /*
     If any are not Radux reducers then assume they are
     Redux reducers and keep as-is in reducers object
  */
  Object.keys(reducers).forEach(
    key =>
      reducers[key] instanceof Reducer &&
      (reducers[key] = reducers[key].getReduxReducer())
  );

  return (stores[storeName] = createStore(
    combineReducers(reducers),
    storeInitialState,
    applyMiddleware(...enhancers)
  ));
};

/**
 * Returns the default store, for params see definition of addNamedStore;
 * 'default' is used as store name
 * @returns {Store<S>}
 */
const addStore = (...args) => {
  return addNamedStore("default", ...args);
};

/**
 * Returns a store by the given name; the default store is returned if no name is supplied
 * @param storeName {String} Name of store
 * @returns {Store<S>}
 */
const getStore = storeName => {
  return stores[storeName || "default"];
};

const dispatch = (storeName, action) => {
  if (arguments.length < 2) [storeName, action] = [null, storeName];
  return getStore(storeName).dispatch(action);
};

/* ####################################################################
      Redux connect argument builders
####################################################################### */

/**
 * Builds mapDispatchToProps argument of Redux connect
 * @param actionCreators
 * @param dispatcherExtensions
 */
const buildDispatchToPropsMap = (
  actionCreators = {},
  dispatcherExtensions = {}
) => dispatch => {
  const combinedCreators = { ...globalActionCreators, ...actionCreators };
  const boundActionCreators = {
    ...bindActionCreators(combinedCreators, dispatch)
  };

  Object.keys(dispatcherExtensions).map(type => {
    boundActionCreators[type] = (...args) => {
      dispatch(actionCreators[type](...args));
      return dispatcherExtensions[type](dispatch, ...args);
    };
  });

  return {
    actions: convertDirectoryNotationToObject(boundActionCreators)
  };
};

/**
 * Builds mapStateToProps argument of Redux connect
 * @param filters [BaseFilter] An array of filters to apply
 */
const buildStateToPropsMap = filters => state => {
  const newState = filters.reduce(
    (newState, filter) => ({ ...newState, ...filter.apply(state) }),
    {}
  );

  /* Always allow our global registered reducers */
  return Object.keys(globalActionCreators).reduce(
    (finalState, key) => ({ ...finalState, [key]: state[key] }),
    newState
  );
};

export {
  buildDispatchToPropsMap,
  buildStateToPropsMap,
  dispatch,
  addStore,
  addNamedStore,
  getStore,
  reducer,
  registerGlobalReducer,
  stateConnector
};
