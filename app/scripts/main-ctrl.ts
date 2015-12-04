namespace app {
  'use strict'

  interface IMainScope extends angular.IScope {
    endpoint: string
    labelLanguages: string
    joinSeparator: string

    propertiesQuery: string
    propertiesQueryEditor: any
    selectQueryEditor: any

    setResults: (any) => void
    maxSubjects: number
    properties: Property[]

    selectNonUniques: (Property) => void

    langSection: string
    constraints: string

    selectQuery: string
    selectQueryLink: string

    shorten: () => void
  }

  class Property {
    constructor(
      public id: ISparqlBinding,
      public label: string,
      public resources: boolean,
      public literals: boolean,
      public statements: number,
      public subjects: number,
      public objects: number,
      public objectsWithLabel: number,
      public objectLabels: number,
      public selectValue: boolean,
      public selectLabel: boolean
    ) {}
    public exampleIds: string[] = []
    public examples: string[] = []
    public nonUniqueObjects: {[id: string]: string}[]
  }

  export class MainController {

    private static selectNonUniqueQuery: string =
`PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sf: <http://ldf.fi/functions#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?objectLabel (COUNT(*) AS ?objects) {
  {
    SELECT DISTINCT ?object {
      # CONSTRAINTS
      ?s <PROPERTY> ?object .
    }
  }
  # OLABELSELECTOR
}
GROUP BY ?objectLabel
HAVING (?objects>1)
`
    constructor(private $scope: IMainScope, private $stateParams: angular.ui.IStateParamsService, private $http: angular.IHttpService, private sparqlService: SparqlService, private $timeout: angular.ITimeoutService) {
      $scope.endpoint = $stateParams['endpoint']
      $scope.labelLanguages = 'fi,sv,en'
      $scope.joinSeparator = ';'
      $scope.constraints = '  '
      $scope.properties = []
      $scope.propertiesQuery =
`PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sf: <http://ldf.fi/functions#>
SELECT ?property ?propertyLabel ?statements ?subjects ?objects ?objectsWithLabel ?objectLabels ?resources ?literals {
  {
    SELECT ?property (COUNT(?objectLabel) as ?objectsWithLabel) (COUNT(DISTINCT ?objectLabel) as ?objectLabels) (COUNT(*) AS ?objects) (MAX(?resource) AS ?resources) (MAX(?literal) AS ?literals) {
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
      BIND(!ISLITERAL(?object) AS ?resource)
      BIND(ISLITERAL(?object) AS ?literal)
    }
    GROUP BY ?property
  }
  {
    SELECT ?property (COUNT(*) AS ?statements) (COUNT(DISTINCT ?s) AS ?subjects) {
          # CONSTRAINTS
          # /CONSTRAINTS
          ?s ?property ?object .
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
      $scope.selectQuery =
`PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sf: <http://ldf.fi/functions#>
SELECT * {
  # CONSTRAINTS
  # /CONSTRAINTS
  # OSELECTOR
  # /OSELECTOR
}
GROUP BY ?s
`
      $scope.$watch('labelLanguages', (nv: string) => {
        let langs: string[] = nv.split(/,\s*/)
        $scope.langSection = ''
        langs.forEach((lang: string) => $scope.langSection += `"${lang}" `)
        let plangSection: string = '\n    ?property sf:preferredLanguageLiteral (skos:prefLabel rdfs:label ' + $scope.langSection + '"" ?propertyLabelO) .'
        let query: string[] = $scope.propertiesQuery.split(/# \/?PLABELSELECTOR/)
        $scope.propertiesQuery = query[0] + '# PLABELSELECTOR' + plangSection + '\n    # /PLABELSELECTOR' + query[2]
        let olangSection: string = '\n        ?object sf:preferredLanguageLiteral (skos:prefLabel ' + $scope.langSection + '"" ?objectLabel) .'
        query = $scope.propertiesQuery.split(/# \/?OLABELSELECTOR/)
        $scope.propertiesQuery = query[0] + '# OLABELSELECTOR' + olangSection + '\n        # /OLABELSELECTOR' + query[2]
      })
      $scope.selectNonUniques = (property: Property) => {
        if (property.nonUniqueObjects) return
        property.nonUniqueObjects = []
        let query: string = MainController.selectNonUniqueQuery
        query = query.replace(/<PROPERTY>/g, this.sparqlService.bindingToString(property.id))
        query = query.replace(/# CONSTRAINTS/g, $scope.constraints)
        query = query.replace(/# OLABELSELECTOR/g, '\n        ?object sf:preferredLanguageLiteral (skos:prefLabel ' + $scope.langSection + '"" ?objectLabel) .')
        this.sparqlService.query($scope.endpoint, query).then(
          (response: angular.IHttpPromiseCallbackArg<ISparqlBindingResult<{[id: string]: ISparqlBinding}>>) => {
             property.nonUniqueObjects = response.data.results.bindings.map(r => this.sparqlService.bindingsToObject<{[id: string]: string}>(r))
          },
          (response: angular.IHttpPromiseCallbackArg<string>) => {
            console.log(response)
          }
        )
      }
      let updateSelectQuery: () => void = () => {
        let fields: string = ''
        let oselector: string = ''
        let groupby: string = ''
        let prefixes = {}
        if ($scope.selectQueryEditor) prefixes = $scope.selectQueryEditor.getPrefixesFromQuery()
        let nsPrefixes = {}
        for (let prefix in prefixes) nsPrefixes[prefixes[prefix]]=prefix
        $scope.properties.filter(p => p.selectLabel || p.selectValue).forEach(p => {
          if (p.subjects === p.statements) {
            fields += ` ?${p.label}`
            groupby += ` ?${p.label}`
            if (p.selectValue && p.selectLabel) {
              fields += ` ?${p.label}_id`
              groupby += ` ?${p.label}_id`
            }
          } else {
            fields += ` (GROUP_CONCAT(DISTINCT ?${p.label}S;separator='${$scope.joinSeparator}') AS ?${p.label})`
            if (p.selectValue && p.selectLabel)
              fields += ` (GROUP_CONCAT(DISTINCT ?${p.label}_idS;separator='${$scope.joinSeparator}') AS ?${p.label}_id)`
          }
          if (p.subjects !== $scope.maxSubjects)
            oselector += '  OPTIONAL {\n  '
          let cns = p.id.value.replace(/(.*[/#]).*/,"$1")
          if (nsPrefixes[cns])
            oselector += `  ?s ${nsPrefixes[cns]}:${p.id.value.replace(/.*[/#]/,"")} ?${p.label}`
          else
            oselector += `  ?s ${this.sparqlService.bindingToString(p.id)} ?${p.label}`
          if (p.selectLabel) {
            oselector += '_id'
            if (p.subjects !== p.statements) oselector += 'S'
            oselector += ' .\n'
            if (p.subjects !== $scope.maxSubjects) oselector += '  '
            if (p.objects !== p.objectsWithLabel) {
              oselector+='  OPTIONAL {\n  '
              if (p.subjects !== $scope.maxSubjects) oselector += '  '
            }
            oselector += `  ?${p.label}_id`
            if (p.subjects !== p.statements) oselector += 'S'
            oselector += ` sf:preferredLanguageLiteral (skos:prefLabel ${$scope.langSection} "" ?${p.label}`
            if (p.subjects !== p.statements) oselector += 'S'
            oselector += ') .\n'
            if (p.objects !== p.objectsWithLabel) {
              if (p.subjects !== $scope.maxSubjects) oselector += '  '
              oselector+='  }\n'
            }
          } else {
            if (p.subjects !== p.statements) oselector += 'S'
            oselector += ' .\n'
          }
          if (p.subjects !== $scope.maxSubjects)
            oselector += '  }\n'
        })
        let query: string[] = $scope.selectQuery.split(/  # \/?CONSTRAINTS/)
        $scope.selectQuery = query[0] + '  # CONSTRAINTS\n' + $scope.constraints.replace(/^\s+/gm, '  ') + '# /CONSTRAINTS' + query[2]
        query = $scope.selectQuery.split(/  # \/?OSELECTOR/)
        $scope.selectQuery = query[0] + '  # OSELECTOR\n' + oselector + '  # /OSELECTOR' + query[2]
        $scope.selectQuery = $scope.selectQuery.replace(/SELECT.*{/, 'SELECT (?s as ?id)' + fields + ' {')
        if (fields === groupby)
          $scope.selectQuery = $scope.selectQuery.replace(/#? ?GROUP BY.*/,'# GROUP BY ?s')
        else
          $scope.selectQuery = $scope.selectQuery.replace(/#? ?GROUP BY.*/,'GROUP BY ?s'+groupby)
      }
      $scope.$watch('properties', updateSelectQuery,true)
      $scope.$watch('selectQuery', (q:string) => {
        if (q)
          $scope.selectQueryLink = $scope.endpoint + '?format=csv&query='+encodeURIComponent(q.replace(/ # .*/g,'').replace(/\s+/g,' '))
      })
      $scope.shorten = () => {
        this.$http.post('https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyDtS96pmj2IeRdw81zobVDpCfs0rFphHvc', {
          longUrl : $scope.selectQueryLink
        }).then(
          (response: angular.IHttpPromiseCallbackArg<any>) => {
            $scope.selectQueryLink = response.data.id
          },
          (response: angular.IHttpPromiseCallbackArg<string>) => {
            console.log(response)
          }
        )
      }
      $scope.setResults = (results: any) => {
        $scope.constraints = $scope.propertiesQuery.split(/# \/?CONSTRAINTS/)[1]
        $scope.maxSubjects = 0
        $scope.properties = []
        results.responseJSON.results.bindings.forEach(binding => {
          let subjects = parseInt(binding.subjects.value, 10)
          if (subjects > $scope.maxSubjects) $scope.maxSubjects = subjects
          $scope.properties.push(new Property(
            binding.property,
            binding.propertyLabel.value.replace(/ä/g,'a').replace(/ö/g,'o').replace(/Ä/g,'A').replace(/Ö/g,'O').replace(/\W/g, '_'),
            binding.resources.value === 'true',
            binding.literals.value === 'true',
            parseInt(binding.statements.value, 10),
            subjects,
            parseInt(binding.objects.value, 10),
            parseInt(binding.objectsWithLabel.value, 10),
            parseInt(binding.objectLabels.value, 10),
            binding.resources.value === 'true' && parseInt(binding.objects.value, 10) === parseInt(binding.objectLabels.value, 10) ? false : true,
            binding.resources.value === 'true' && binding.objectLabels.value !== '0'
          ))
        })
        $timeout(() => $scope.selectQueryEditor.addPrefixes($scope.propertiesQueryEditor.getPrefixesFromQuery()))
        $scope.$digest()
        $timeout(() => {
          updateSelectQuery()
          this.sparqlService.query($scope.endpoint, $scope.selectQuery + 'LIMIT 5').then(
             (response: angular.IHttpPromiseCallbackArg<ISparqlBindingResult<{[id: string]: ISparqlBinding}>>) => {
                response.data.results.bindings.map(r => this.sparqlService.bindingsToObject<{[id: string]: string}>(r)).forEach(r => {
                  $scope.properties.forEach(p => {
                    if (p.selectLabel && p.selectValue)
                      p.exampleIds.push(r[p.label+'_id'])
                    p.examples.push(r[p.label])
                  })
                })
             },
             (response: angular.IHttpPromiseCallbackArg<string>) => {
               console.log(response)
             }
          )
        })
      }
    }
  }
}
