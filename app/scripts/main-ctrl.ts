namespace app {
  'use strict'

  interface IMainScope extends angular.IScope {
    propertiesQuery: string
    setResults: (any) => void
    properties: Property[]
    labelLanguages: string
    joinSeparator: string
    endpoint: string
  }

  class Property {
    public id: string
    public label: string
    public selected: boolean
    public nonunique: number
  }

  export class MainController {
    constructor(private $scope: IMainScope, private $stateParams: angular.ui.IStateParamsService) {
      $scope.endpoint = $stateParams['endpoint']
      $scope.labelLanguages = 'fi,sv,en'
      $scope.joinSeparator = ';'
      $scope.propertiesQuery = `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sf: <http://ldf.fi/functions#>
SELECT ?property (SAMPLE(?propertyLabelS) AS ?propertyLabel) {
  {
    SELECT ?property (COUNT(DISTINCT ?objectLabel) as ?objectLabels) (COUNT(DISTINCT ?object) AS ?objects) {
      # CONSTRAINTS
      ?s ?property ?o .
      # /CONSTRAINTS
      # OLABELSELECTOR
      # /OLABELSELECTOR
    }
    GROUP BY ?property
  }
  # PLABELSELECTOR
  # /PLABELSELECTOR
}
GROUP BY ?property`
      $scope.$watch('labelLanguages', (nv: string) => {
        let langs: string[] = nv.split(/,\s*/)
        let langSection: string = ''
        langs.forEach((lang: string) => langSection += `"${lang}" `)
        let plangSection: string = '\n  ?property sf:preferredLanguageLiteral (skos:prefLabel rdfs:label ' + langSection + '"" ?propertyLabelS) .'
        let query: string[] = $scope.propertiesQuery.split(/# \/?PLABELSELECTOR/)
        $scope.propertiesQuery = query[0] + '# PLABELSELECTOR' + plangSection + '\n  # /PLABELSELECTOR' + query[2]
        let olangSection: string = '\n      ?object sf:preferredLanguageLiteral (skos:prefLabel ' + langSection + '"" ?objectLabel) .'
        query = $scope.propertiesQuery.split(/# \/?OLABELSELECTOR/)
        $scope.propertiesQuery = query[0] + '# OLABELSELECTOR' + olangSection + '\n      # /OLABELSELECTOR' + query[2]
      })
      $scope.setResults = (results: any) => {
        $scope.properties = results.responseJSON.results.bindings.map((binding) => {
          return {
            id: binding.property.value,
            label: binding.propertyLabel.value,
            nonunique: parseInt(binding.objects.value, 10) - parseInt(binding.labels.value, 10),
            selected: true
          }
        })
        $scope.$digest()
      }
    }
  }
}
