import express from 'express'
import prisma from '../../db/prisma.js'
const router = express.Router()
import bcrypt from 'bcrypt'
import jwt from "jsonwebtoken"
import { APP_NAME, JWT_SECRET } from "../../constant/index.js"
import uploadCloudinary from "../../utils/cloudinary/uploadCloudinary.js"
import sendWhatsapp from '../../utils/fonnte/sendWhatsapp.js'

export const login = async (req, res) => {
    const { email, password } = req.body
    try {
        if (!email || !password) {
            return res.status(400).json({ status: 400, message: 'Email dan Password harus diisi!' })
        }
        const [admin, boardingHouse] = await Promise.all([
            prisma.admin.findFirst({
                where: {
                    email
                },
                select: {
                    adminId: true,
                    email: true,
                    password: true,
                }
            }),
            prisma.boardingHouse.findFirst({
                where: {
                    email
                },
                select: {
                    boardingHouseId: true,
                    email: true,
                    password: true,
                    isConfirmed: true
                }
            }),
        ])
        if (!admin && !boardingHouse) {
            return res.status(400).json({ status: 400, message: 'Email tidak ditemukan!' })
        }
        if (boardingHouse && !boardingHouse.isConfirmed) {
            return res.status(400).json({ status: 400, message: 'Akun anda belum dikonfirmasi!' })
        }
        const id = admin ? admin.adminId : boardingHouse.boardingHouseId
        const role = admin ? "ADMIN" : "BOARDING_HOUSE"
        const accessToken = jwt.sign({ id, role }, JWT_SECRET)
        if (admin) {
            const check = await bcrypt.compare(password, admin.password)
            if (check) {
                return res.status(200).json({ status: 200, message: 'Login berhasil!', data: { accessToken, role } })
            } else {
                return res.status(400).json({ status: 400, message: 'Password salah!' })
            }
        } else {
            const check = await bcrypt.compare(password, boardingHouse.password)
            if (check) {
                return res.status(200).json({ status: 200, message: 'Login berhasil!', data: { accessToken, role } })
            } else {
                return res.status(400).json({ status: 400, message: 'Password salah!' })
            }
        }
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}

export const registerBoarding = async (req, res) => {
    const { name, owner, email, phone, description, district, subdistrict, location, maxCapacity, price, } = req.body
    const pictures = req.files
    try {
        if (!name || !owner || !email || !phone || !description || !district || !subdistrict || !location || !maxCapacity || !price) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        if (isNaN(Number(maxCapacity)) || isNaN(Number(price))) {
            return res.status(400).json({ status: 400, message: 'Harga dan Kapasitas harus berupa angka!' })
        }
        if (!pictures || pictures.length === 0) {
            return res.status(400).json({ status: 400, message: 'Unggah gambar terlebih dahulu!' })
        }
        const data = { name, owner, email, phone, description, district, subdistrict, location, maxCapacity: Number(maxCapacity), price: Number(price) }

        const [admin, boardingHouse, user] = await Promise.all([
            prisma.admin.findFirst({
                where: {
                    email
                },
                select: {
                    adminId: true,
                    email: true,
                    password: true,
                }
            }),
            prisma.boardingHouse.findFirst({
                where: {
                    email
                },
                select: {
                    boardingHouseId: true,
                    email: true,
                    password: true
                }
            }),
            prisma.user.count({
                where: {
                    email
                }
            })
        ])
        if (admin || boardingHouse || user) {
            return res.status(400).json({ status: 400, message: 'Email sudah terdaftar!' })
        }
        const uris = pictures.map(picture => ({ picture: picture.path }))
        const create = await prisma.boardingHouse.create({
            data: {
                ...data,
                isConfirmed: false,
                isActive: false,
                pictures: {
                    createMany: {
                        data: uris
                    }
                }
            },
            include: {
                pictures: true
            }
        })
        let message = ''
        message = `*${APP_NAME}*\n\nKos: ${name} berhasil melakukan registrasi di ApparteKost. \n\nTunggu konfirmasi dalam 3x24 jam!`

        sendWhatsapp(phone, message)
        return res.status(200).json({ status: 200, message: 'Pendaftaran berhasil!, tunggu konfirmasi dalam 3x24 jam!', data: create })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}


router.post("/login", login)
router.post("/register-boarding", uploadCloudinary("boarding").array("pictures"), registerBoarding)

export default router