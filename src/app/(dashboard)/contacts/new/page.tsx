import { ContactForm } from '@/components/contacts/contact-form'

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Novo Contato</h1>
      <ContactForm />
    </div>
  )
}
