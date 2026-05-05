import { PropertyForm } from '@/components/properties/property-form'

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Novo Imóvel</h1>
      <PropertyForm />
    </div>
  )
}
