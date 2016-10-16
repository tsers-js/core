import {zipObj} from "@tsers/core"

const ELEM = 0
const TEXT = 1

const htmlAttrs =
  "accept accept-charset accesskey action align alt async autocomplete autofocus " +
  "autoplay autosave bgcolor buffered challenge charset checked cite code " +
  "codebase color cols colspan content contenteditable contextmenu controls coords " +
  "datetime default defer dir dirname disabled download draggable dropzone " +
  "enctype for form formaction headers height hidden high href hreflang http-equiv " +
  "icon id ismap itemprop keytype kind label lang language list loop low manifest " +
  "max maxlength media method min multiple muted name novalidate open optimum pattern " +
  "ping placeholder poster preload radiogroup readonly rel required reversed rows " +
  "rowspan sandbox scope scoped seamless selected shape size sizes span spellcheck " +
  "src srcdoc srclang srcset start step summary tabindex target title type " +
  "usemap width wrap"

const boolAttrs =
  "allowfullscreen async autofocus autoplay checked compact controls declare default " +
  "defaultchecked defaultmuted defaultselected defer disabled draggable enabled " +
  "formnovalidate hidden indeterminate inert ismap itemscope loop multiple muted " +
  "nohref noresize noshade novalidate nowrap open pauseonexit readonly required reversed " +
  "scoped seamless selected sortable spellcheck translate truespeed typemustmatch visible"

const noBubbleEvents =
  "load unload scroll focus blur DOMNodeRemovedFromDocument DOMNodeInsertedIntoDocument " +
  "loadstart progress error abort load loadend"

const htmlProps =
  "value"

const zipFlags = flagStr =>
  zipObj(flagStr.split(" ").map(a => [a.trim(), true]))


// ======

export const NodeTypes = {
  ELEM,
  TEXT
}

// identity for pending prop values
export const PPENDING = {}

// identity for vndoes
export const VNODE = {}

export const attrByName = zipFlags(htmlAttrs)

export const boolAttrByName = zipFlags(boolAttrs)

export const propsByName = zipFlags(htmlProps)

export const noBubblesByName = zipFlags(noBubbleEvents)

export const isHtmlProp = key =>
  propsByName[key]

export const isAttr = attr =>
  (attrByName[attr] || (attr.indexOf("data-") === 0 && attr.length > 5))

export const isBoolAttr = attr =>
  boolAttrByName[attr]

export const bubbles = eventName =>
  !noBubblesByName[eventName]
