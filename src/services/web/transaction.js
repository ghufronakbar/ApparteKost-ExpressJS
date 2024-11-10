import express from 'express'
import prisma from '../../db/prisma.js'
const router = express.Router()
import bcrypt from 'bcrypt'
import jwt from "jsonwebtoken"
import { APP_NAME, JWT_SECRET } from "../../constant/index.js"
import uploadCloudinary from "../../utils/cloudinary/uploadCloudinary.js"
import verification from "../../middleware/verification.js"
import sendWhatsapp from '../../utils/fonnte/sendWhatsapp.js'
import randomCharacter from '../../utils/randomCharacter.js'


const transactions = async (req, res) => {
    const { id } = req.decoded
    const active = req.query.active === "true" ? true : false
    if (isNaN(Number(id))) return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
    console.log({ active })
    try {

        const data = await prisma.boardingHouse.findFirst({
            where: {
                boardingHouseId: Number(id)
            },
            select: {
                maxCapacity: true
            }
        })
        const bookings = await prisma.booking.findMany({
            where: {
                AND: [
                    {
                        boardingHouseId: Number(id)
                    },
                    active ? { isActive: true } : {}
                ]
            },
            orderBy: {
                bookedDate: "desc"
            },
            select: {
                bookingId: true,
                isActive: true,
                bookedDate: true,
                user: {
                    select: {
                        userId: true,
                        name: true,
                        email: true,
                        phone: true,
                        picture: true,                        
                    }
                },                
            }
        })
        const room = {
            total: data.maxCapacity,
            available: data.maxCapacity,
            active: 0
        }
        for (const booking of bookings) {
            if (booking.isActive) {
                room.active++
                room.available--
            }
        }
        return res.status(200).json({ status: 200, message: 'Data Transaksi', data: { room, bookings } })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const setInactive = async (req, res) => {
    const { id } = req.params
    if (isNaN(Number(id))) return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
    try {
        const check = await prisma.booking.count({
            where: {
                bookingId: Number(id)
            }
        })
        if (!check) return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        const data = await prisma.booking.update({
            where: {
                bookingId: Number(id)
            },
            data: {
                isActive: false
            }
        })
        return res.status(200).json({ status: 200, message: 'Berhasil menghapus keaktifan kamar', data })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}


router.get("/", verification(["BOARDING_HOUSE"]), transactions)
router.patch("/:id", verification(["BOARDING_HOUSE"]), setInactive)

export default router