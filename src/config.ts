import { Prefixes, Store } from 'n3'
import { Term } from '@rdfjs/types'
import { DefaultTheme, Theme } from './theme'
import { PREFIX_SHACL, RDF_PREDICATE_TYPE, SHAPES_GRAPH } from './constants'
import { Plugins } from './plugin'

export class Config {
    shapes: string | null = null
    shapesUrl: string | null = null
    shapeSubject: string | null = null
    values: string | null = null
    valuesUrl: string | null = null
    valueSubject: string | null = null
    language: string | null = null
    loadOwlImports: string = 'true'
    submitButton: string | null = null

    private _theme: Theme = new DefaultTheme()
    private _lists: Record<string, Term[]> = {}
    private _groups: Array<string> = []
    private _shapesGraph = new Store()
    private _dataGraph = new Store()
    private _plugins: Plugins = {}
    private _prefixes: Prefixes = {}

    equals(other: Config): boolean {
        if (!other) {
            return false
        }
        for (const key of Object.keys(this)) {
            if (this[key] !== other[key]) {
                return false
            }
        }
        return true
    }

    get shapesGraph() {
        return this._shapesGraph
    }

    set shapesGraph(graph: Store) {
        this._shapesGraph = graph
        this._lists = graph.extractLists()
        this._groups = []
        graph.getQuads(null, RDF_PREDICATE_TYPE, `${PREFIX_SHACL}PropertyGroup`, SHAPES_GRAPH).forEach(groupQuad => {
            this._groups.push(groupQuad.subject.value)
        })
    }

    get dataGraph() {
        return this._dataGraph
    }

    set dataGraph(graph: Store) {
        this._dataGraph = graph
    }

    get lists() {
        return this._lists
    }

    get groups() {
        return this._groups
    }

    set theme(theme: Theme) {
        this._theme = theme
    }

    get prefixes() {
        return this._prefixes
    }

    registerPrefixes(prefixes: Prefixes) {
        for (const key in prefixes) {
            this._prefixes[key] = prefixes[key]
        }
    }

    get plugins() {
        return this._plugins
    }

    set plugins(plugins: Plugins) {
        this._plugins = plugins
    }

    static from(elem: HTMLElement): Config {
        const config = new Config()
        for (const key of Object.keys(config)) {
            if (elem.dataset[key] !== undefined) {
                config[key] = elem.dataset[key]
            }
        }
        if (!config.language) {
            config.language = navigator.language
        }
        return config
    }

    static get keysAsDataAttributes(): Array<string> {
        return Object.keys(new Config()).filter(key => { return !key.startsWith('_')}).map(key => {
            // convert camelcase key to kebap case
            key = key.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
            return 'data-' + key
        })
    }
}