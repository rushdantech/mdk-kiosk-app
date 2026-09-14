export const OFFER_RECORDS_DESC =
  'The resident asked to check records. Use assessment for cukai taksiran, compound for saman or kompaun, all for both. This only prepares a confirmation question — do not show MyKad or any list yet. Ask them to confirm first.'

export const CONFIRM_RECORDS_DESC =
  'The resident clearly said yes to checking records with MyKad. Call this only after they confirm. This shows the MyKad reader.'

export const OFFER_PAYMENT_DESC =
  'The resident named a pay method. Use duitnow or card to ask for confirmation only — never show the QR or card terminal yet. Use choose if they want to pay but have not named a method.'

export const CONFIRM_PAYMENT_DESC =
  'The resident clearly confirmed payment. Show the DuitNow QR or card terminal. Call only after they say yes.'

export const CANCEL_ACTION_DESC =
  'The resident cancelled or said no. Clear any pending MyKad or payment step and stay in conversation.'

export function realtimeToolDefs() {
  return [
    {
      type: 'function',
      name: 'offer_records',
      description: OFFER_RECORDS_DESC,
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['assessment', 'compound', 'all'] },
        },
        required: ['kind'],
      },
    },
    {
      type: 'function',
      name: 'confirm_records',
      description: CONFIRM_RECORDS_DESC,
      parameters: { type: 'object', properties: {} },
    },
    {
      type: 'function',
      name: 'offer_payment',
      description: OFFER_PAYMENT_DESC,
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['duitnow', 'card', 'choose'] },
        },
        required: ['method'],
      },
    },
    {
      type: 'function',
      name: 'confirm_payment',
      description: CONFIRM_PAYMENT_DESC,
      parameters: { type: 'object', properties: {} },
    },
    {
      type: 'function',
      name: 'cancel_action',
      description: CANCEL_ACTION_DESC,
      parameters: { type: 'object', properties: {} },
    },
  ]
}

export function chatToolDefs() {
  return realtimeToolDefs().map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}
