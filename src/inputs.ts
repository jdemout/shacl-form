import { DataFactory, NamedNode, Literal } from 'n3'
import { Term } from '@rdfjs/types'
import { PREFIX_SHACL, PREFIX_XSD, PREFIX_RDF } from './constants'
import { createInputListEntries } from './util'
import { ShaclPropertySpec } from './property-spec'

export type Editor = HTMLElement & { value: string }

export abstract class InputBase extends HTMLElement {
    static idCtr = 0
    property: ShaclPropertySpec
    editor: Editor
    required = false

    constructor(property: ShaclPropertySpec) {
        super()

        this.property = property
        this.required = this.property.minCount !== undefined && this.property.minCount > 0

        this.editor = this.createEditor()
        this.editor.id = `e${InputBase.idCtr++}`
        this.editor.setAttribute('value', property.defaultValue?.value || '')
        this.editor.classList.add('editor', 'form-control')
        // add path to editor to provide a hook to external apps
        this.editor.dataset.path = this.property.path

        const label = document.createElement('label')
        label.htmlFor = this.editor.id
        label.innerText = property.label
        if (property.description) {
            label.setAttribute('title', property.description.value)
        }

        const placeholder = property.description ? property.description.value : property.pattern ? property.pattern : null
        if (placeholder) {
            this.editor.setAttribute('placeholder', placeholder)
        }
        if (this.required) {
            this.editor.setAttribute('required', 'true')
            label.classList.add('required')
        }

        this.classList.add('prop')
        this.appendChild(label)
        this.appendChild(this.editor)
    }

    setValue(value: Term) {
        this.editor.value = value.value
    }

    abstract createEditor(): Editor
    abstract toRDFObject(): Literal | NamedNode | undefined
}

export class InputDate extends InputBase {
    createEditor(): Editor {
        const input = document.createElement('input')
        if (this.property.datatype?.value  === PREFIX_XSD + 'dateTime') {
            input.type = 'datetime-local'
        }
        else {
            input.type = 'date'
        }
        input.classList.add('pr-0')
        return input
    }

    setValue(value: Term) {
        let isoDate = new Date(value.value).toISOString()
        if ((this.editor as HTMLInputElement).type === 'datetime-local') {
            isoDate = isoDate.slice(0, 19)
        } else {
            isoDate = isoDate.slice(0, 10)
        }
        super.setValue(DataFactory.literal(isoDate, this.property.datatype))
    }

    toRDFObject(): Literal | undefined {
        if (this.editor.value) {
            return DataFactory.literal(this.editor.value, this.property.datatype)
        }
        return
    }
}

export class InputText extends InputBase {
    constructor(property: ShaclPropertySpec) {
        super(property)

        const input = this.editor as HTMLInputElement
        if (property.minLength) {
            input.minLength = property.minLength
        }
        if (property.maxLength) {
            input.maxLength = property.maxLength
        }
        if (property.pattern) {
            input.pattern = property.pattern
        }
    }

    createEditor(): Editor {
        let input
        if (this.property.singleLine === false) {
            input = document.createElement('textarea')
            input.rows = 5
        }
        else {
            input = document.createElement('input')
            input.type = 'text'
        }
        return input
    }

    toRDFObject(): Literal | NamedNode | undefined {
        if (this.editor.value) {
            if (this.property.class || this.property.nodeKind?.id === `${PREFIX_SHACL}IRI`) {
                return DataFactory.namedNode(this.editor.value)
            } else {
                return DataFactory.literal(this.editor.value, this.property.datatype)
            }
        }
    }
}

export class InputLangString extends InputText {
    language: string | undefined
    langChooser: HTMLInputElement | HTMLSelectElement

    constructor(property: ShaclPropertySpec) {
        super(property)
        this.langChooser = this.createLangChooser()
        this.appendChild(this.langChooser)
    }

    setValue(value: Term) {
        super.setValue(value)
        if (value instanceof Literal) {
            this.langChooser.value = value.language
        }
    }

    toRDFObject(): Literal | NamedNode | undefined {
        if (this.editor.value) {
            return DataFactory.literal(this.editor.value, this.langChooser.value ? this.langChooser.value : this.property.datatype)
        }
    }

    createLangChooser(): HTMLInputElement | HTMLSelectElement {
        let chooser
        if (this.property.languageIn?.length) {
            chooser = document.createElement('select')
            for (const lang of this.property.languageIn) {
                const option = document.createElement('option')
                option.innerText = lang.value
                chooser.appendChild(option)
            }
        } else {
            chooser = document.createElement('input')
            chooser.maxLength = 5 // e.g. en-US
        }
        chooser.title = 'Language of the text'
        chooser.placeholder = 'lang?'
        chooser.classList.add('lang-chooser')
        // if lang chooser changes, fire a change event on the text input instead. this is for shacl validation handling.
        chooser.addEventListener('change', (ev) => { ev.stopPropagation(); this.editor.dispatchEvent(new Event('change', { bubbles: true })) })
        return chooser
    }
}

export class InputBoolean extends InputBase {
    constructor(property: ShaclPropertySpec) {
        super(property)
        // 'required' on checkboxes forces the user to tick the checkbox, which is not what we want here
        this.editor.removeAttribute('required')
        this.querySelector(':scope label')?.classList.remove('required')
    }

    createEditor(): Editor {
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.classList.add('ml-0')
        return input
    }

    setValue(value: Term) {
        if (value instanceof Literal) {
            const checkbox = this.editor as HTMLInputElement
            checkbox.checked = value.value === 'true'
        }
    }

    toRDFObject(): Literal | undefined {
        const checkbox = this.editor as HTMLInputElement
        // emit 'false' only when required
        if (checkbox.checked || this.required) {
            return DataFactory.literal(checkbox.checked ? 'true' : 'false', this.property.datatype)
        }
    }
}

export class InputNumber extends InputBase {
    constructor(property: ShaclPropertySpec) {
        super(property)

        const input = this.editor as HTMLInputElement
        const min = property.minInclusive ? property.minInclusive : property.minExclusive ? property.minExclusive + 1 : undefined
        const max = property.maxInclusive ? property.maxInclusive : property.maxExclusive ? property.maxExclusive - 1 : undefined
        if (min) {
            input.min = String(min)
        }
        if (max) {
            input.max = String(max)
        }
        if (property.datatype?.value !== PREFIX_XSD + 'integer') {
            input.step = '0.1'
        }
    }

    createEditor(): Editor {
        const input = document.createElement('input')
        input.type = 'number'
        input.classList.add('pr-0')
        return input
    }

    toRDFObject(): Literal | undefined {
        if (this.editor.value) {
            return DataFactory.literal(parseFloat(this.editor.value), this.property.datatype)
        }
    }
}

export type InputListEntry = { value: Term, label?: string }

export class InputList extends InputBase {
    constructor(property: ShaclPropertySpec, listEntries?: InputListEntry[]) {
        super(property)
        if (listEntries) {
            this.setListEntries(listEntries)
        }
    }

    setListEntries(list: InputListEntry[]) {
        const select = this.editor as HTMLSelectElement
        // add an empty element
        const option = document.createElement('option')
        option.value = ''
        select.options.add(option)

        for (const item of list) {
            const option = document.createElement('option')
            option.innerHTML = item.label ? item.label : item.value.value
            option.value = item.value.value
            select.options.add(option)
        }
    }

    createEditor(): Editor {
        return document.createElement('select')
    }

    toRDFObject(): Literal | NamedNode | undefined {
        if (this.editor.value) {
            if (this.property.class || this.property.nodeKind?.id === `${PREFIX_SHACL}IRI`) {
                return DataFactory.namedNode(this.editor.value)
            } else {
                return DataFactory.literal(this.editor.value, this.property.datatype)
            }
        }
    }
}

export function inputFactory(property: ShaclPropertySpec): InputBase {
    // check if it is a list
    if (property.shaclIn) {
        const list = property.config.lists[property.shaclIn]
        if (list?.length) {
            return new InputList(property, createInputListEntries(list, property.config.shapesGraph, property.config.language))
        }
        else {
            console.error('list not found:', property.shaclIn, 'existing lists:', property.config.lists)
        }
    }

    // check if it a langstring
    if  (property.datatype?.value === `${PREFIX_RDF}langString` || property.languageIn?.length) {
        return new InputLangString(property)
    }

    switch (property.datatype?.value.replace(PREFIX_XSD, '')) {
        case 'string':
            return new InputText(property)
        case 'integer':
        case 'float':
        case 'double':
        case 'decimal':
            return new InputNumber(property)
        case 'date':
        case 'dateTime':
            return new InputDate(property)
        case 'boolean':
            return new InputBoolean(property)
        }

    // nothing found, fallback to 'text'
    return new InputText(property)
}

window.customElements.define('input-langstring', InputLangString)
window.customElements.define('input-date', InputDate)
window.customElements.define('input-text', InputText)
window.customElements.define('input-number', InputNumber)
window.customElements.define('input-boolean', InputBoolean)
window.customElements.define('input-list', InputList)
