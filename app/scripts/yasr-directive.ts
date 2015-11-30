namespace app {
  'use strict'
  interface IYASRScope extends angular.IScope {
    prefixes: () => {}
  }

  declare var YASR: any

  export class YasrDirective {
    constructor(private $timeout: angular.ITimeoutService) {}
    public restrict: string = 'E'
    public scope: {[id: string]: string} = {
      data: '=',
      prefixes: '='
    }
    public link: (...any) => void = ($scope: IYASRScope, element: JQuery, attr: angular.IAttributes) => {
      let yasr: any = YASR(element[0], {getUsedPrefixes: $scope.prefixes})
      $scope.$watch('data', (data: any, odata: any) => { if (data) yasr.setResponse(data) })
    }
  }
}
