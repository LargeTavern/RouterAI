const modelVariants = {
    // Claude-3.5 Models
    'claude-3-5-sonnet-20241022': [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-latest',
        'anthropic.claude-3-5-sonnet-20241022-v2:0',
        'claude-3-5-sonnet-v2@20241022'
    ],
    'claude-3-5-haiku': [
        'claude-3-5-haiku-20241022',
        'claude-3-5-haiku-latest',
        'anthropic.claude-3-5-haiku-20241022-v1:0',
        'claude-3-5-haiku@20241022'
    ],
    'claude-3-5-sonnet-20240620': [
        'claude-3-5-sonnet-20240620',
        'anthropic.claude-3-5-sonnet-20240620-v1:0',
        'claude-3-5-sonnet@20240620'
    ],

    // Claude-3 Models
    'claude-3-opus': [
        'claude-3-opus-20240229',
        'anthropic.claude-3-opus-20240229',
        'claude-3-opus@20240229'
    ],
    'claude-3-sonnet': [
        'claude-3-sonnet-20240229',
        'anthropic.claude-3-sonnet-20240229',
        'claude-3-sonnet@20240229'
    ],
    'claude-3-haiku': [
        'claude-3-haiku-20240307',
        'anthropic.claude-3-haiku-20240307',
        'claude-3-haiku@20240307'
    ],

    // Claude-2 Models
    'claude-2.1': [
        'claude-2.1',
        'anthropic.claude-2.1',
        'claude-2.1@20240126'
    ],
    'claude-2.0': [
        'claude-2.0',
        'anthropic.claude-2.0',
        'claude-2.0@20240126'
    ],
};

const modelToBase = new Map();
for (const [baseModel, variants] of Object.entries(modelVariants)) {
    for (const variant of variants) {
        modelToBase.set(variant, baseModel);
    }
}

module.exports = {
    modelVariants,
    modelToBase,
    
    getBaseModel(modelName) {
        return modelToBase.get(modelName) || modelName;
    },

    getModelVariants(baseModel) {
        return modelVariants[baseModel] || [baseModel];
    },

    isSameModel(modelName1, modelName2) {
        return this.getBaseModel(modelName1) === this.getBaseModel(modelName2);
    }
};
