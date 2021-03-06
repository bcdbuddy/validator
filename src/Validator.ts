export interface IValidatorOptions {
  data: Map<string, any> | {},
  rules: any,
  messages?: any,
  models?: any,
  abortEarly?: boolean
}


export interface IValidatorMessage {
  required: string,
  email: string,
  confirmed: string
}

/**
* All methods return boolean indicating whether or not the test failed
*/
export class Validator {
  protected data: Map<string, any>;
  protected rules: any;
  protected messages: Map<string, string>;
  protected errors: Map<string, string> = new Map();
  protected models: any;

  constructor (options: IValidatorOptions) {
    const defaultOptions = {
      data: {},
      rules: {},
      messages: {},
      models: {},
      abortEarly: false
    }
    options = Object.assign({}, defaultOptions, options);
    this.data = new Map(Object.entries(options.data));
    this.rules = options.rules;
    this.models = options.models;
    const messages = Object.assign({}, {
      required: ':field is required.',
      min_length: ':field length need to be at least :length: character(s) long.',
      max_length: ':field length need to be at most :length: character(s) long.',
      between_length: ':field length need to be at between :min and max characters.',
      email: ':value is not a valid email.',
      confirmed: ':field does not match confirmation field.',
      min: ':field must be greater than or equal :min',
      max: ':field must be lesser than or equal :max',
      between: ':field must be between :min and :max',
      unique: ':field already exists.',
      exists: 'No :model matching :key = :value',
      required_unless: ':field is required when \':otherField\' is not present',
      required_with: '\':field\' is required when \':otherField\' is defined.',
      greater_than: '\':field\' should be a greater than \':otherField\'.',
      date: '\':field\' should be a valid date.',
      after: '\':field\' should be a date greater past \':date\'.',
      before: '\':field\' should be a date before \':date\'.',
      in_array: '\':value\' is not a value from \':values\'.',
      regex: '\':field\' does not match regex \':regex\'.',
      boolean: '\':field\' should be true or false value not \':value\'.'
    }, options.messages);

    this.messages = new Map(Object.entries(messages));
  }

  /**
   * @returns Promise<Validator>
   */
  async validate (): Promise<Validator> {
    let fields: string[] = Object.keys(this.rules);
    for (let field of fields) {
      const validationRule = this.rules[field]
      if (typeof validationRule === 'function') {
        if (this.data.has(field)) {
          const fieldValue = this.data.get(field)
          try {
            // no need to get the result since on error it will throw an error
            await validationRule(fieldValue)
          } catch (e) {
            this.addError(field, e.message.split(':value').join(fieldValue))
          }
        }
        continue
      }
      let methods: string[]
      if (Array.isArray(validationRule)) {
        methods = validationRule
      } else {
        methods = validationRule.split('|');
      }
      methods.map(async m => {
        let parts: string[] = m.split(':');
        let params: any = [];
        params.push(field)
        const method = parts[0]
        if (method === 'regex') {
          params.push(parts[1])
        } else if (parts.length >= 2) {
          params.push(...parts[1].split(','));
        }
        // console.log('method: %s, params: %o', method, params)
        // this[method].apply(this, params)
        // only check the other rules when field is defined in data except when the rule is 'required'
        // TODO: if (options.abortEarly) then stop on first error
        switch (method) {
          case 'required':
            this.required.apply(this, params)
            break;
          case 'min_length':
            this.min_length.apply(this, params)
            break;
          case 'max_length':
            this.max_length.apply(this, params)
            break;
          case 'between_length':
            this.between_length.apply(this, params)
            break;
          case 'email':
            this.email.apply(this, params)
            break;
          case 'confirmed':
            this.confirmed.apply(this, params)
            break;
          case 'min':
            this.min.apply(this, params)
            break;
          case 'max':
            this.max.apply(this, params)
            break;
          case 'between':
            this.between.apply(this, params)
            break;
          case 'unique':
            await this.unique.apply(this, params)
            break;
          case 'exists':
            await this.exists.apply(this, params)
            break;
          case 'required_unless':
            this.required_unless.apply(this, params)
            break;
          case 'required_with':
            this.required_with.apply(this, params)
            break;
          case 'greater_than':
            this.greater_than.apply(this, params)
            break
          case 'date':
            this.date.apply(this, params)
            break
          case 'before':
            this.before.apply(this, params)
            break
          case 'after':
            this.after.apply(this, params)
            break
          case 'array':
            this.array.apply(this, params)
            break;
          case 'regex':
            this.regex.apply(this, params)
            break;
          case 'in_array':
            this.in_array.apply(this, params)
            break;
          case 'boolean':
            this.boolean.apply(this, params)
            break;
          default:
            throw new Error('Unknown validation rule: ' + method)
        }
      })
    }

    return this
  }


  /**
   * @param {string} field
   * @returns boolean
   */
  required (field: string): boolean {
    if (!this.data.has(field) || String(this.data.get(field)).length === 0) {
      this.addError(field, this.getErrorFor('required', field))
      return false
    }
    return true
  }

  /**
   * @param {string} field
   * @param {string} l
   * @returns boolean
   */
  min_length (field: string, l: string): boolean {
    const length = Number(l)
    const fieldLength = Buffer.byteLength(String(this.data.get(field)))
    if (this.data.has(field) && fieldLength < length) {
      this.addError(field, this.getErrorFor('min_length', field, {length}))
      return true
    }
    return false
  }

  /**
   * @param {string} field
   * @param {string} l
   * @returns boolean
   */
  max_length (field: string, l: string): boolean {
    const length = Number(l)
    const fieldLength = Buffer.byteLength(String(this.data.get(field)))
    if (this.data.has(field) && fieldLength > length) {
      this.addError(field, this.getErrorFor('max_length', field, {length}))
      return true
    }
    return false
  }

  between_length (field: string, min: string, max: string): boolean {
    const fieldLength = Buffer.byteLength(String(this.data.get(field)))
    if (fieldLength < +min || fieldLength > +max) {
      this.addError(field, this.getErrorFor('between_length', field, {min, max}))
      return true
    }
    return false
  }

  /**
   *
   * @param {string} field
   * @returns boolean
   */
  email (field: string): boolean {
    if (!this.data.has(field)) {
      return false
    }
    let emailRegex: any = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    if (!this.data.get(field).match(emailRegex)) {
      this.addError(field, this.getErrorFor('email', field))
      return true
    }
    return false
  }

  /**
   * @param {string} field
   * @returns boolean
   */
  confirmed (field: string): boolean {
    if (!this.data.has(field)) {
      return false
    }
    if (this.data.get(field) !== this.data.get(`${field}_confirmation`)) {
      this.addError(field, this.getErrorFor('confirmed', field))
      return true
    }
    return false
  }

  /**
   *
   * @param {string} field
   * @param {string} min
   * @returns boolean
   */
  min (field: string, min: string): boolean {
    if (!this.data.has(field)) {
      return false
    }
    const value = Number(this.data.get(field))
    if (value < +min) {
      this.addError(field, this.getErrorFor('min', field, {min}))
      return true
    }
    return false
  }

  /**
   *
   * @param {string} field
   * @param {string} max
   * @returns boolean
   */
  max (field: string, max: string): boolean {
    if (!this.data.has(field)) {
      return false
    }
    const value = Number(this.data.get(field))
    if (value > +max) {
      this.addError(field, this.getErrorFor('max', field, {max}))
      return true
    }
    return false
  }

  /**
   *
   * @param {string} field
   * @param {string} min
   * @param {string} max
   * @returns boolean
   */
  between (field: string, min: string, max: string): boolean {
    if (!this.data.has(field)) {
      return false
    }
    const value = Number(this.data.get(field))
    if (value < +min || value > +max) {
      this.addError(field, this.getErrorFor('between', field, {min, max}))
      return true
    }
    return false
  }

  /**
   * @param {string} field
   * @param {string} model
   * @returns Promise<boolean>
   */
  async unique (field: string, model: string): Promise<boolean> {
    if (!this.data.has(field)) {
      return false
    }
    const exists = await this._modelExists(field, model, field)
    if (exists) {
      this.addError(field, this.getErrorFor('unique', field, {model}))
    }
    return !exists
  }

  /**
   * @param {string} field
   * @param {string} model
   * @param {string} key
   * @returns Promise<boolean>
   * @private
   */
  _modelExists (field: string, model: string, key: string): Promise<boolean> {
    let DbModel = this.models[model]
    if (!DbModel) {
      throw new Error(`${model} is not defined when calling Validator::make`)
    }
    let filter: any = {}
    filter[key] = this.data.get(field)
    return DbModel.exists(filter)
  }

  /**
   * @param {string} field
   * @param {string} model
   * @param {string} key
   * @returns Promise<boolean>
   */
  async exists (field: string, model: string, key: string): Promise<boolean> {
    if (!this.data.has(field)) {
      return false
    }
    try {
      const exists = await this._modelExists(field, model, key)
      if (!exists) {
        this.addError(field, this.getErrorFor('exists', field, {key, model}))
      }
      return !exists
    } catch (e) {
      const message = (e.kind === 'ObjectId' && e.name === 'CastError')
        ? this.getErrorFor('exists', field, {key, model})
        : e.message
      this.addError(field, message)
      return true
    }
  }

  /**
   * @param {string} field
   * @param {string} otherField
   * @returns boolean
   */
  required_unless (field: string, otherField: string): boolean {
    const hasError: boolean = !this.data.has(field) && !this.data.has(otherField)
    if (hasError) {
      this.addError(field, this.getErrorFor('required_unless', field, {otherField}))
    }
    return hasError
  }

  /**
   * @param {string} field
   * @param {string} otherField
   * @returns boolean
   */
  required_with (field: string, otherField: string): boolean {
    const hasError: boolean = this.data.has(otherField) && !this.data.has(field)
    if (hasError) {
      this.addError(field, this.getErrorFor('required_with', field, {otherField}))
    }
    return hasError
  }

  /**
   * @param {string} field
   * @param {number} otherField
   * @returns {boolean}
   */
  greater_than (field: string, otherField: number) {
    if (!this.data.has(field)) {
      return false
    }
    const hasError = (+this.data.get(field) || 0) <= otherField
    if (hasError) {
      this.addError(field, this.getErrorFor('greater_than', field, {otherField}))
    }
    return hasError
  }

  /**
   * @param {string} dateString
   * @returns {year: string, month: string, day: string, date: string, time: string, hour: string, minute: string, second: string}
   * @private
   */
  _validateDate (dateString: string) {
    const regex = /(([0-9]{4})-([0-9]{2})-([0-9]{2}))(.(([0-9]{2}):([0-9]{2}):([0-9]{2})))?/
    const matches = dateString.match(regex) || []
    if (matches.length <= 3) {
      return false
    }
    const {1: date, 2: year, 3: month, 4: day, 5: time, 7: hour, 8: minute, 9: second} = matches
    if (parseInt(year) < 1
      || parseInt(month) < 1 || parseInt(month) > 12
      || parseInt(day) < 1 || parseInt(day) > 31
      || parseInt(hour) < 0 || parseInt(hour) > 23
      || parseInt(minute) < 0 || parseInt(minute) > 59
      || parseInt(second) < 0 || parseInt(second) > 59
    ) {
      return false
    }
    return {year, month, day, hour, minute, second, date, time}
  }

  date (field: string) {
    if (!this.data.has(field)) {
      return false
    }
    const value = this.data.get(field)
    const isInPredefinedValues = ['today', 'tomorrow', 'yesterday'] // just this for now
      .some(predefined => predefined === value)
    if (isInPredefinedValues) {
      return false
    }
    const hasError = isNaN(+new Date(value))
    if (hasError) {
      this.addError(field, this.getErrorFor('date', field))
    }
    return hasError
  }

  before (field: string, date: string) {
    if (!this.data.has(field)) {
      return false
    }
    let minDate: number
    if (date === 'today') {
      minDate = +new Date()
    } else {
      const result = this._validateDate(date)
      if (!result) {
        this.addError(field, `${date} is not a valid date in yyyy-mm-dd format`)
        return true
      }
      const {year, month, day} = result
      minDate = +new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }
    const result = this._validateDate(this.data.get(field))
    if (!result) {
      this.addError(field, `${this.data.get(field)} is not a valid date in yyyy-mm-dd format`)
      return true
    }
    const {year, month, day} = result
    const inputDate = +new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const hasError = inputDate < minDate
    if (hasError) {
      this.addError(field, this.getErrorFor('after', field, {date}))
    }
    return hasError
  }

  /**
   * @param {string} field
   * @param {string} date
   * @returns {boolean}
   */
  after (field: string, date: string) {
    if (!this.data.has(field)) {
      return false
    }
    let minDate: number
    if (date === 'today') {
      const today = new Date()
      minDate = +new Date(today.getUTCFullYear(), today.getMonth(), today.getDate())
    } else {
      const result = this._validateDate(date)
      if (!result) {
        this.addError(field, `${date} is not a valid date in yyyy-mm-dd format`)
        return true
      }
      const {year, month, day} = result
      minDate = +new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }
    const result = this._validateDate(this.data.get(field))
    if (!result) {
      this.addError(field, `${this.data.get(field)} is not a valid date in yyyy-mm-dd format`)
      return true
    }
    const {year, month, day} = result
    const inputDate = +new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const hasError = inputDate < minDate
    if (hasError) {
      this.addError(field, this.getErrorFor('after', field, {date}))
    }
    return hasError
  }

  regex (field: string, reg: string) {
    if (!this.data.has(field)) {
      return false
    }

    const regex = new RegExp(reg)
    const hasError = !regex.test(this.data.get(field))
    if (hasError) {
      this.addError(field, this.getErrorFor('regex', field, {reg: regex}))
    }
    return hasError
  }

  array (field: string, otherField: string): boolean {
    return false
    // TODO:
    // const hasError: boolean = this.data.has(otherField) && !this.data.has(field)
    // if (hasError) {
    //   this.addError(field, this.getErrorFor('array', field, {otherField}))
    // }
    // return hasError
  }

  in_array (field: string, ...values: string[]): boolean {
    if (!this.data.has(field)) {
      return false
    }
    const hasError: boolean = !values.includes(this.data.get(field))
    if (hasError) {
      this.addError(field, this.getErrorFor('in_array', field, {values: values.join()}))
    }
    return hasError
  }

  boolean (field: string): boolean {
    if (!this.data.has(field)) {
      return false
    }
    const hasError: boolean = ![true, false, 'true', 'false', 1, 0, '1', '0'].includes(this.data.get(field))
    if (hasError) {
      this.addError(field, this.getErrorFor('boolean', field))
    }
    return hasError
  }

  /**
   * @param {IValidatorOptions} options
   * @returns Validator
   */
  static make (options: IValidatorOptions) {
    return new Validator(options)
      .validate()
  }

  /**
   * @returns boolean
   */
  fails (): boolean {
    return this.errors.size !== 0
  }

  /**
   * @returns {[key: string]: string}
   */
  getErrors (): { [key: string]: string } {
    // Object.fromEntries is still on Draft on EcmaScript so use the following code
    // return Object.fromEntries(this.errors)
    let obj: { [key: string]: string } = {}
    for (let [key, value] of this.errors.entries()) {
      obj[key] = value
    }
    return obj
  }

  getErrorMessage (): string {
    const errors = this.getErrors()
    const keys = Object.keys(errors)
    return keys.length > 0 ? errors[keys[0]] : ''
  }

  /**
   * @param {string} rule
   * @param {string} field
   * @param {any} options
   * @returns string
   */
  protected getErrorFor (rule: string, field: string, options: any = {}): string {
    options.value = this.data.get(field)
    options.field = field
    const fieldErrorMessage = this.messages.get(field) || {}
    let message = fieldErrorMessage[rule] || this.messages.get(rule)
    for (let key of Object.keys(options)) {
      message = message.split(`:${key}`).join(options[key])
    }
    return message
  }


  /**
   * @param {string} field
   * @param {string} message
   * @returns Validator
   */
  public addError (field: string, message: string): Validator {
    this.errors.set(field, message)
    return this
  }
}

export default Validator
