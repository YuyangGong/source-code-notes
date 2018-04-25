/* @flow */

let decoder

export default {
  // html entity解码, 这里采用的是借助dom的方式
  decode (html: string): string {
    decoder = decoder || document.createElement('div')
    decoder.innerHTML = html
    return decoder.textContent
  }
}
