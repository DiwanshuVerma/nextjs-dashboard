'use server'
import { z } from 'zod'
import postgres from 'postgres'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' })

const FormSchema = z.object({
    id: z.string(),  // will be created on the database
    customerId: z.string({
        invalid_type_error: 'Please select a customer.'
    }),
    amount: z.coerce.number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: "Please select an  invoice status."
    }),
    date: z.string()
})

// -----> create invoice

const CreateInvoice = FormSchema.omit({ id: true, date: true })

export type State = {
    errors?: {
        customerId?: string[],
        amount?: string[],
        status?: string[],
    },
    message?: string | null
}

export async function createInvoice(prevState: State, formData: FormData) {
    // validate form fields using zod
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    })

    // if form validation fails, return errors early, otherwise, continue
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error?.flatten().fieldErrors,
            message: "Missing Fields. Failed to Create Invoice."
        }
    }

    // prepare data for inserting into database
    const { customerId, amount, status } = validatedFields.data
    const amountCents = amount * 100
    const date = new Date().toISOString().split('T')[0]

    // insert data into the database
    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountCents}, ${status}, ${date})
    `;

    } catch (error) {
        // if a databse error occures
        return {
            message: "Database error: Failed to create invoice"
        }
    }

    // Revalidate the chache for the invoices page ans redirect the user
    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

// -----> update invoice

const UpdateInvoice = FormSchema.omit({ id: true, date: true })

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing fields. Failed to update invoice"
        }
    }

    const { customerId, amount, status } = validatedFields.data

    const amountCents = amount * 100

    try {
        await sql`
        UPDATE invoices
        SET customer_id=${customerId}, amount=${amountCents}, status=${status}
        WHERE id=${id}
    `
    } catch (error) {
        return {
            message: "Database error, unable to update invoice"
        }
    }
    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

export async function deleteInvoice(id: string) {
    // throw new Error('Failed to')
    try {
        await sql`
        DELETE FROM invoices
        WHERE id=${id}
    `
    } catch (error) {
        console.error(error)
    }
    revalidatePath('/dashboard/invoices')
}