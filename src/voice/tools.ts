export const SHOW_BILLS_DESC =
  'The resident asked about their records. Use assessment for cukai taksiran, compound for saman or kompaun, all if they ask for every bill. This opens the MyKad reader — tell them to insert MyKad. Do not say the bill list is visible yet.'

export const START_PAYMENT_DESC =
  'Propose a payment method on the right side of the screen and keep talking. Use duitnow or card only to ask for confirmation — never jump straight to the QR or card terminal. Use choose if they want to pay but have not named a method.'

export const CONFIRM_PAYMENT_DESC =
  'The resident confirmed. Show the DuitNow QR or card terminal on the right. Stay on the call and keep talking.'

export const CANCEL_PAYMENT_DESC =
  'The resident cancelled the payment method. Return to the bill list and keep talking.'

export function realtimeToolDefs() {
  return [
    {
      type: 'function',
      name: 'show_bills',
      description: SHOW_BILLS_DESC,
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
      name: 'start_payment',
      description: START_PAYMENT_DESC,
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
      name: 'cancel_payment',
      description: CANCEL_PAYMENT_DESC,
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
