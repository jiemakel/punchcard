namespace app {
  'use strict'

  interface IMainScope extends angular.IScope {
    propertiesQuery: string
    selectQuery: string
    labelSelect: string
    resourceAndLabelSelect: string
    setResults: (any) => void
    properties: Property[]
    labelLanguages: string
    joinSeparator: string
    endpoint: string
    exampleObjects: {[id: string]: string}[]
  }

  class Property {
    public id: string
    public label: string
    public selected: boolean
    public nonunique: number
  }

  export class MainController {
    constructor(private $scope: IMainScope, private $stateParams: angular.ui.IStateParamsService, private sparqlService: SparqlService) {
      $scope.endpoint = $stateParams['endpoint']
      $scope.labelLanguages = 'fi,sv,en'
      $scope.joinSeparator = ';'
      $scope.propertiesQuery = `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sf: <http://ldf.fi/functions#>
SELECT ?property ?propertyLabel ?objectLabels ?objects ?resources ?literals {
  {
    SELECT ?property (COUNT(DISTINCT ?objectLabel) as ?objectLabels) (COUNT(DISTINCT ?object) AS ?objects) (MAX(?resource) AS ?resources) (MAX(?literal) AS ?literals) {
      {
        SELECT DISTINCT ?property ?object {
          # CONSTRAINTS
          # /CONSTRAINTS
          ?s ?property ?object .
        }
      }
      OPTIONAL {
        # OLABELSELECTOR
        # /OLABELSELECTOR
      }
      BIND(COALESCE(?objectLabelO,IF(ISLITERAL(?object),?object,REPLACE(STR(?object),".*[/#]",""))) AS ?objectLabel)
      BIND(!ISLITERAL(?object) AS ?resource)
      BIND(ISLITERAL(?object) AS ?literal)
    }
    GROUP BY ?property
  }
  OPTIONAL {
    # PLABELSELECTOR
    # /PLABELSELECTOR
  }
  BIND(COALESCE(?propertyLabelO,REPLACE(STR(?property),".*[/#]","")) AS ?propertyLabel)
}
`
      $scope.labelSelect = `
  OPTIONAL {
    ?s <PROPERTY> ?oINDEX .
    OPTIONAL {
      # OLABELSELECTOR
      # /OLABELSELECTOR
    }
    BIND(COALESCE(?objectLabelOINDEX,IF(ISLITERAL(?oINDEX),?oINDEX,REPLACE(STR(?oINDEX),".*[/#]",""))) AS ?FIELD)
  }
`
      $scope.resourceAndLabelSelect = `
  OPTIONAL {
    ?s <PROPERTY> ?oINDEX .
    OPTIONAL {
      # OLABELSELECTOR
      # /OLABELSELECTOR
    }
    BIND(COALESCE(?objectLabelOINDEX,IF(ISLITERAL(?oINDEX),?oINDEX,REPLACE(STR(?oINDEX),".*[/#]",""))) AS ?FIELD)
    BIND(?INDEX AS ?FIELDId)
  }
`
      $scope.selectQuery = `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sf: <http://ldf.fi/functions#>
SELECT <FIELDS> {
  # CONSTRAINTS
  # /CONSTRAINTS
  # OSELECTOR
  # /OSELECTOR
}
`
      $scope.$watch('labelLanguages', (nv: string) => {
        let langs: string[] = nv.split(/,\s*/)
        let langSection: string = ''
        langs.forEach((lang: string) => langSection += `"${lang}" `)
        let plangSection: string = '\n    ?property sf:preferredLanguageLiteral (skos:prefLabel rdfs:label ' + langSection + '"" ?propertyLabelO) .'
        let query: string[] = $scope.propertiesQuery.split(/# \/?PLABELSELECTOR/)
        $scope.propertiesQuery = query[0] + '# PLABELSELECTOR' + plangSection + '\n    # /PLABELSELECTOR' + query[2]
        let olangSection: string = '\n        ?object sf:preferredLanguageLiteral (skos:prefLabel ' + langSection + '"" ?objectLabelO) .'
        query = $scope.propertiesQuery.split(/# \/?OLABELSELECTOR/)
        $scope.propertiesQuery = query[0] + '# OLABELSELECTOR' + olangSection + '\n        # /OLABELSELECTOR' + query[2]
      })
      $scope.setResults = (results: any) => {
        $scope.properties = results.responseJSON.results.bindings.map((binding) => {
          return {
            id: binding.property.value,
            label: binding.propertyLabel.value,
            resources: binding.resources.value === 'true',
            literals: binding.literals.value === 'true',
            nonunique: parseInt(binding.objects.value, 10) - parseInt(binding.objectLabels.value, 10),
            selected: true
          }
        })
        let query: string = $scope.selectQuery
        this.sparqlService.query($scope.endpoint, query).then(
           (response: angular.IHttpPromiseCallbackArg<ISparqlBindingResult<{[id: string]: ISparqlBinding}>>) => {
              $scope.exampleObjects = response.data.results.bindings.map(r => this.sparqlService.bindingsToObject<{[id: string]: string}>(r))
           },
           (response: angular.IHttpPromiseCallbackArg<string>) => {
             console.log(response)
           }
        )
        $scope.$digest()
      }
    }
  }
}
