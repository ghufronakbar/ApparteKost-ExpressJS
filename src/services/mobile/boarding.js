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

const boardings = async (req, res) => {
    try {
        const data = await prisma.boardingHouse.findMany({
            orderBy: {
                boardingHouseId: "desc"
            }, include: {
                _count: {
                    select: {
                        bookings: true
                    }
                },
                pictures: {
                    select: {
                        picture: true
                    }
                },
                reviews: {
                    select: {
                        rating: true
                    }
                }
            }
        })

        for (const d of data) {
            d.averageRating = d.reviews.reduce((a, b) => a + b.rating, 0) / d.reviews.length || 0
        }
        return res.status(200).json({ status: 200, message: 'Data semua kos', data })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const boarding = async (req, res) => {
    const { id } = req.params
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        const data = await prisma.boardingHouse.findFirst({
            where: {
                boardingHouseId: Number(id)
            },
            include: {
                _count: true,
                pictures: true,
                reviews: true
            }
        })
        if (!data) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        data.averageRating = data.reviews.reduce((a, b) => a + b.rating, 0) / data.reviews.length || 0
        return res.status(200).json({ status: 200, message: 'Detail Kos', data })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

router.get("/", verification(["USER"]), boardings)
router.get("/:id", verification(["USER"]), boarding)


export default router