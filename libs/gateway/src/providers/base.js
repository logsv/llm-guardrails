/* eslint-disable no-unused-vars */
export class BaseLLMProvider {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Generate completion from LLM
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options
   * @returns {Promise<Object>} Normalized response
   */
  async generate(messages, options) {
    throw new Error('Method not implemented');
  }
}
