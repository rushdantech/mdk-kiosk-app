import { computed } from 'vue'
import { session } from './store/session'

const copy = {
  brand: { ms: 'Kaunter Digital', en: 'Digital Counter' },
  council: { ms: 'Majlis Daerah Kerian', en: 'Kerian District Council' },
  help: { ms: 'Panggil kakitangan', en: 'Call a staff member' },
  startOver: { ms: 'Mula semula', en: 'Start over' },
  back: { ms: 'Kembali', en: 'Back' },
  homeTitle: { ms: 'Selamat datang.', en: 'Welcome.' },
  homeLead: {
    ms: 'Tiada perlu beratur. Pilih cara yang paling senang untuk anda.',
    en: 'No queue. Choose the easiest way for you.',
  },
  doorKadTitle: { ms: 'Masukkan MyKad', en: 'Insert MyKad' },
  doorKadBody: {
    ms: 'Paling senang. Tiada taip. Masukkan kad, semak, bayar.',
    en: 'Easiest. No typing. Insert your card, review, pay.',
  },
  doorVoiceTitle: { ms: 'Cakap dengan pembantu', en: 'Talk to the assistant' },
  doorVoiceBody: {
    ms: 'Perbualan langsung. Cakap terus — pembantu dengar dan jawab.',
    en: 'A live conversation. Just speak — the assistant hears and answers.',
  },
  doorScanTitle: { ms: 'Imbas borang', en: 'Scan a form' },
  doorScanBody: {
    ms: 'Letak kertas di hadapan kamera kiosk.',
    en: 'Hold the paper in front of the kiosk camera.',
  },
  doorKeyinTitle: { ms: 'Taip nombor bil', en: 'Key in bill details' },
  doorKeyinBody: {
    ms: 'Masukkan no. akaun, notis, plat, atau MyKad — seperti di kaunter lama.',
    en: 'Enter account, notice, plate, or MyKad — same as the current kiosk.',
  },
  langMs: { ms: 'Bahasa Melayu', en: 'Bahasa Melayu' },
  langEn: { ms: 'English', en: 'English' },
  kadWait: {
    ms: 'Sila masukkan MyKad ke dalam pembaca di bawah skrin.',
    en: 'Please insert your MyKad into the reader below the screen.',
  },
  kadHint: {
    ms: 'Kad masuk menghadap ke atas. Tunggu bunyi “bip”.',
    en: 'Insert the card face up. Wait for the beep.',
  },
  kadSimulate: { ms: 'Simulasi: kad dikesan', en: 'Demo: card detected' },
  kadFound: { ms: 'MyKad dikesan', en: 'MyKad detected' },
  kadValid: { ms: 'MyKad sah', en: 'MyKad valid' },
  kadQuery: { ms: 'Mencari rekod di MDK…', en: 'Searching council records…' },
  kadQueryHint: {
    ms: 'Sila tunggu. Jangan cabut kad.',
    en: 'Please wait. Do not remove the card.',
  },
  kadQueryChip: { ms: 'Membaca chip MyKad', en: 'Reading the MyKad chip' },
  kadQueryIc: { ms: 'Mengesahkan nombor pengenalan', en: 'Checking the identity number' },
  kadQueryTax: { ms: 'Mencari cukai taksiran', en: 'Looking up assessment tax' },
  kadQuerySummons: { ms: 'Mencari saman / kompaun', en: 'Looking up summons' },
  continue: { ms: 'Teruskan', en: 'Continue' },
  billsHello: { ms: 'Bil untuk', en: 'Bills for' },
  mykadNo: { ms: 'No. MyKad', en: 'MyKad no.' },
  billsLead: {
    ms: 'Tandakan apa yang ingin dibayar. Anda boleh pilih satu atau semua.',
    en: 'Tick what you want to pay. You may choose one or all.',
  },
  selectAll: { ms: 'Pilih semua', en: 'Select all' },
  clearAll: { ms: 'Kosongkan', en: 'Clear' },
  payNow: { ms: 'Bayar', en: 'Pay' },
  nothingDue: { ms: 'Tiada bil dipilih', en: 'No bill selected' },
  assessment: { ms: 'Cukai taksiran', en: 'Assessment' },
  compound: { ms: 'Kompaun', en: 'Compounds' },
  account: { ms: 'No. akaun', en: 'Account no.' },
  notice: { ms: 'No. notis', en: 'Notice no.' },
  plate: { ms: 'No. plat', en: 'Plate' },
  special: { ms: 'Kadar istimewa', en: 'Special rate' },
  total: { ms: 'Jumlah', en: 'Total' },
  payTitle: { ms: 'Cara bayar', en: 'How to pay' },
  payLead: {
    ms: 'Pilih satu. Resit dihantar selepas bayaran berjaya.',
    en: 'Choose one. A receipt is sent after payment succeeds.',
  },
  duitnow: { ms: 'DuitNow QR', en: 'DuitNow QR' },
  duitnowBody: {
    ms: 'Buka aplikasi bank. Imbas kod pada skrin ini.',
    en: 'Open your bank app. Scan the code on this screen.',
  },
  card: { ms: 'Kad debit / kredit', en: 'Debit / credit card' },
  cardBody: {
    ms: 'Ketik, sapu, atau masukkan kad di terminal di sebelah kanan.',
    en: 'Tap, swipe, or insert your card in the terminal on the right.',
  },
  scanQr: {
    ms: 'Imbas dengan aplikasi bank anda',
    en: 'Scan with your bank app',
  },
  timeout: { ms: 'Kod tamat dalam', en: 'Code expires in' },
  paidSimulate: { ms: 'Simulasi: sudah bayar', en: 'Demo: mark as paid' },
  cardWait: {
    ms: 'Sila guna terminal di sebelah kanan skrin. Jangan cabut kad sehingga lampu hijau.',
    en: 'Use the terminal to the right of the screen. Do not remove the card until the light is green.',
  },
  cardSimulate: { ms: 'Simulasi: kad diluluskan', en: 'Demo: card approved' },
  doneTitle: { ms: 'Bayaran berjaya', en: 'Payment successful' },
  doneLead: {
    ms: 'Simpan nombor resit. Perubahan di kaunter mungkin ambil sehingga 48 jam.',
    en: 'Keep the receipt number. The counter record may take up to 48 hours.',
  },
  receipt: { ms: 'No. resit', en: 'Receipt no.' },
  another: { ms: 'Bayar bil lain', en: 'Pay another bill' },
  voiceTitle: { ms: 'Pembantu suara', en: 'Voice assistant' },
  voiceLead: {
    ms: 'Perbualan langsung. Cakap bila-bila. Saya dengar sekarang.',
    en: 'Live conversation. Speak anytime. I am listening now.',
  },
  live: { ms: 'Langsung', en: 'Live' },
  loadingAgent: { ms: 'Loading AI Agent', en: 'Loading AI Agent' },
  loadingAgentLead: {
    ms: 'Menyambung mikrofon dan pembantu suara. Sila tunggu sebentar.',
    en: 'Connecting the microphone and voice assistant. Please wait a moment.',
  },
  loadingAgentStatus: { ms: 'Menyambung…', en: 'Connecting…' },
  confirmPayTitle: { ms: 'Sahkan cara bayar', en: 'Confirm how to pay' },
  confirmDuitnow: {
    ms: 'Paparkan kod DuitNow QR sekarang? Ketik Sahkan atau cakap ya.',
    en: 'Show the DuitNow QR now? Tap Confirm or say yes.',
  },
  confirmCard: {
    ms: 'Teruskan ke terminal kad debit / kredit? Ketik Sahkan atau cakap ya.',
    en: 'Continue to the debit / credit card terminal? Tap Confirm or say yes.',
  },
  confirmYes: { ms: 'Sahkan', en: 'Confirm' },
  confirmNo: { ms: 'Kembali', en: 'Back' },
  connecting: { ms: 'Menyambung…', en: 'Connecting…' },
  speaking: { ms: 'Pembantu sedang cakap', en: 'Assistant is speaking' },
  thinking: { ms: 'Sebentar…', en: 'One moment…' },
  listeningLive: { ms: 'Mendengar — cakap sahaja', en: 'Listening — just speak' },
  voiceHint: {
    ms: 'Mikrofon terbuka. Cakap seperti di kaunter.',
    en: 'The microphone is open. Speak as you would at the counter.',
  },
  muted: { ms: 'Mikrofon ditutup', en: 'Microphone muted' },
  mute: { ms: 'Senyapkan', en: 'Mute' },
  unmute: { ms: 'Buka mikrofon', en: 'Unmute' },
  voiceError: {
    ms: 'Pembantu tidak dapat bersambung. Cuba lagi, atau taip nombor bil.',
    en: 'The assistant could not connect. Try again, or key in the bill.',
  },
  showList: { ms: 'Tunjuk senarai bil', en: 'Show bill list' },
  voiceMykadTitle: { ms: 'Masukkan MyKad', en: 'Insert MyKad' },
  voiceMykadLead: {
    ms: 'Sila masukkan MyKad ke pembaca di bawah untuk cari rekod.',
    en: 'Please insert your MyKad into the reader below to look up records.',
  },
  voiceMykadStatus: {
    ms: 'Menunggu MyKad…',
    en: 'Waiting for MyKad…',
  },
  voiceQueryBoth: {
    ms: 'Mencari cukai dan saman',
    en: 'Looking up assessment and summons',
  },
  you: { ms: 'Anda', en: 'You' },
  assistant: { ms: 'Pembantu', en: 'Assistant' },
  summons: { ms: 'Saman', en: 'Summons' },
  voiceBillsTitle: { ms: 'Cukai dan saman', en: 'Assessment and summons' },
  scanTitle: { ms: 'Imbas kertas', en: 'Scan the paper' },
  scanLead: {
    ms: 'Pegang bil atau saman supaya kod bar ada dalam kotak.',
    en: 'Hold the bill or summons so the barcode sits inside the box.',
  },
  scanHint: {
    ms: 'Jauhkan kira-kira satu jengkal. Tahan senyap.',
    en: 'Hold about a handspan away. Keep still.',
  },
  scanDemo: { ms: 'Simulasi: imbas notis contoh', en: 'Demo: scan sample notice' },
  scanValid: { ms: 'Kod bar dikesan', en: 'Barcode detected' },
  scanQuery: { ms: 'Mencari rekod di MDK…', en: 'Searching council records…' },
  scanQueryHint: {
    ms: 'Sila tunggu sebentar.',
    en: 'Please wait a moment.',
  },
  scanQueryCode: { ms: 'Membaca kod bar', en: 'Reading the barcode' },
  scanQueryRecord: { ms: 'Mencari rekod MDK', en: 'Looking up the MDK record' },
  scanQueryAssessment: { ms: 'Mencari cukai taksiran', en: 'Looking up assessment tax' },
  scanQuerySummons: { ms: 'Mencari saman / kompaun', en: 'Looking up summons' },
  scanListening: {
    ms: 'Kamera terbuka. Imbas kod bar pada kertas.',
    en: 'Camera is on. Scan the barcode on the paper.',
  },
  scanNeedCamera: {
    ms: 'Benarkan kamera, kemudian imbas kod bar sebenar.',
    en: 'Allow the camera, then scan a real barcode.',
  },
  scanUnknown: {
    ms: 'Kod ini tiada dalam rekod MDK',
    en: 'This code is not in the MDK record',
  },
  scanCodesHint: {
    ms: 'Untuk ujian, buka senarai kod contoh pada peranti lain.',
    en: 'For testing, open the sample codes on another device.',
  },
  scanCodesOpen: { ms: 'Buka kod contoh', en: 'Open sample codes' },
  scanCodesTitle: { ms: 'Kod bar contoh', en: 'Sample barcodes' },
  scanCodesLead: {
    ms: 'Cetak atau paparkan pada telefon lain, kemudian imbas di kiosk. Kod lain tidak diterima.',
    en: 'Print these or show them on another phone, then scan at the kiosk. Other codes are rejected.',
  },
  foundPaper: { ms: 'Kertas dikesan', en: 'Paper detected' },
  keyinTitle: { ms: 'Taip butiran', en: 'Key in details' },
  keyinLead: {
    ms: 'Pilih cukai atau kompaun, kemudian taip nombor pada papan kekunci.',
    en: 'Choose assessment or compound, then type the number on the keyboard.',
  },
  keyinAssessment: { ms: 'Cukai taksiran', en: 'Assessment' },
  keyinCompound: { ms: 'Kompaun', en: 'Compound' },
  searchBy: { ms: 'Cari mengikut', en: 'Search by' },
  idNumber: { ms: 'No. pengenalan', en: 'ID number' },
  noticeNumber: { ms: 'No. notis', en: 'Notice number' },
  plateNumber: { ms: 'No. plat kenderaan', en: 'Vehicle plate number' },
  accountHint: {
    ms: 'Contoh: T-070017708-08 atau nombor legasi.',
    en: 'Example: T-070017708-08 or a legacy number.',
  },
  idHint: {
    ms: 'MyKad, nombor pasport, atau nombor syarikat.',
    en: 'MyKad, passport, or company registration number.',
  },
  noticeHint: {
    ms: 'Nombor notis tercetak di bahagian atas saman.',
    en: 'The notice number is printed at the top of the summons.',
  },
  plateHint: {
    ms: 'Taip plat tanpa jarak atau simbol.',
    en: 'Enter the plate without spaces or symbols.',
  },
  sample: { ms: 'Contoh', en: 'Sample' },
  sampleTitle: { ms: 'Contoh nombor akaun', en: 'Account number sample' },
  useSample: { ms: 'Gunakan contoh ini', en: 'Use this sample' },
  enterDetails: { ms: 'Cari bil', en: 'Find bills' },
  checking: { ms: 'Mencari…', en: 'Checking…' },
  notFound: { ms: 'Tiada rekod', en: 'No records found' },
  notFoundAssessment: {
    ms: 'Tiada cukai tertunggak untuk nombor ini.',
    en: 'No amount due for this number.',
  },
  notFoundCompound: {
    ms: 'Tiada kompaun yang boleh dibayar dalam talian. Sila semak di kaunter jika saman tidak boleh dikompaun.',
    en: 'No online compoundable summonses were found. Please check at the counter if you have a non-compoundable summons.',
  },
  keyboard: { ms: 'Papan kekunci', en: 'On-screen keyboard' },
  clear: { ms: 'Padam', en: 'Clear' },
  space: { ms: 'Jarak', en: 'Space' },
  staffNote: {
    ms: 'Mock sahaja — pembaca MyKad, terminal kad, dan kamera akan disambung kemudian.',
    en: 'Mock only — MyKad reader, card terminal, and camera will be wired later.',
  },
} as const

type Key = keyof typeof copy

export function useT() {
  return computed(() => {
    session.lang
    return (key: Key) => copy[key][session.lang]
  })
}

export function billTitle(bill: { titleMs: string; titleEn: string }): string {
  return session.lang === 'ms' ? bill.titleMs : bill.titleEn
}

export function billDetail(bill: { detailMs: string; detailEn: string }): string {
  return session.lang === 'ms' ? bill.detailMs : bill.detailEn
}

export function billDate(bill: { dateMs: string; dateEn: string }): string {
  return session.lang === 'ms' ? bill.dateMs : bill.dateEn
}
