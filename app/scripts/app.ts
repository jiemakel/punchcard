namespace app {
  'use strict'
  let m: angular.IModule = angular.module('app', [ 'http-auth-interceptor', 'ui.router', 'ui.bootstrap', 'ui.sortable' ])
  m.config(($stateProvider: angular.ui.IStateProvider, $urlRouterProvider: angular.ui.IUrlRouterProvider) => {
    $urlRouterProvider.otherwise('/')
    $stateProvider.state('main', {
      url: '/?endpoint',
      templateUrl: 'partials/main.html',
      controller: 'MainController'
      })
  })
  }
