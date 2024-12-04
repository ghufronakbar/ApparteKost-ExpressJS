import express from 'express'
import prisma from '../../db/prisma.js'
const router = express.Router()
import bcrypt from 'bcrypt'
import jwt from "jsonwebtoken"
import { APP_NAME, JWT_SECRET } from "../../constant/index.js"
import uploadCloudinary from "../../utils/cloudinary/uploadCloudinary.js"
import removeCloudinary from "../../utils/cloudinary/removeCloudinary.js"
import sendWhatsapp from '../../utils/fonnte/sendWhatsapp.js'
import verification from '../../middleware/verification.js'
import getRelativeTime from '../../utils/getRelativeTime.js'

export const login = async (req, res) => {
    const { email, password } = req.body
    try {
        if (!email || !password) {
            return res.status(400).json({ status: 400, message: 'Email dan Password harus diisi!' })
        }
        const data = await prisma.user.findFirst({
            where: {
                email
            },
        })
        if (!data) {
            return res.status(404).json({ status: 404, message: 'Email atau Password salah!' })
        }
        const role = "USER"
        const accessToken = jwt.sign({ id: data.userId, role }, JWT_SECRET)
        const check = await bcrypt.compare(password, data.password)
        if (!check) {
            return res.status(400).json({ status: 400, message: 'Password salah!' })
        }
        return res.status(200).json({ status: 200, message: 'Login berhasil!', data: { accessToken, role } })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}

const register = async (req, res) => {
    const { email, password, name, phone } = req.body
    try {
        if (!email || !password || !name || !phone) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        const [user, admin, boardingHouse] = await Promise.all([
            prisma.user.count({
                where: {
                    email
                },
            }),
            prisma.admin.count({
                where: {
                    email
                },
            }),
            prisma.boardingHouse.count({
                where: {
                    email
                },
            }),
        ])
        if (user + admin + boardingHouse > 0) {
            return res.status(400).json({ status: 400, message: 'Email sudah terdaftar' })
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const created = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                phone,
            }
        })
        const role = "USER"
        const accessToken = jwt.sign({ id: created.userId, role }, JWT_SECRET)
        return res.status(200).json({ status: 200, message: 'Register berhasil!', data: { ...created, accessToken, role } })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}

const profile = async (req, res) => {
    const { id } = req.decoded
    try {
        const data = await prisma.user.findFirst({
            where: {
                userId: Number(id)
            },
        })
        if (!data) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        return res.status(200).json({ status: 200, message: 'Detail akun', data })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}

const edit = async (req, res) => {
    const { id } = req.decoded
    const { name, phone, email } = req.body
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        if (!name || !phone || !email) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        const [admin, user, boardingHouse] = await Promise.all([
            prisma.admin.findFirst({
                where: {
                    email
                },
                select: {
                    adminId: true,
                    email: true,
                }
            }),
            prisma.user.findFirst({
                where: {
                    email
                },
                select: {
                    userId: true,
                    email: true,
                }
            }),
            prisma.boardingHouse.findFirst({
                where: {
                    email
                },
                select: {
                    boardingHouseId: true,
                    email: true,
                }
            }),
        ])
        if (admin || boardingHouse) {
            return res.status(400).json({ status: 400, message: 'Email sudah terdaftar' })
        }
        if (user && user.userId !== Number(id)) {
            return res.status(400).json({ status: 400, message: 'Email sudah terdaftar' })
        }
        const updated = await prisma.user.update({
            where: {
                userId: Number(id)
            },
            data: {
                name,
                phone
            }
        })
        return res.status(200).json({ status: 200, message: 'Berhasil mengubah profile', data: updated })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}

const picture = async (req, res) => {
    const { id } = req.decoded
    const picture = req.file
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        if (!picture) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        const check = await prisma.user.findFirst({
            where: {
                userId: Number(id)
            },
            select: {
                picture: true
            }
        })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        if (check.picture) {
            removeCloudinary(check.picture, "profile")
        }
        const updated = await prisma.user.update({
            where: {
                userId: Number(id)
            },
            data: {
                picture: picture.path
            }
        })
        return res.status(200).json({ status: 200, message: 'Berhasil mengubah foto profile', data: updated })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}

const deletePicture = async (req, res) => {
    const { id } = req.decoded
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        const check = await prisma.user.findFirst({
            where: {
                userId: Number(id)
            },
            select: {
                picture: true
            }
        })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        if (check.picture) {
            removeCloudinary(check.picture, "profile")
        }
        const updated = await prisma.user.update({
            where: {
                userId: Number(id)
            },
            data: {
                picture: null
            }
        })
        return res.status(200).json({ status: 200, message: 'Berhasil menghapus foto profile', data: updated })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}

const changePassword = async (req, res) => {
    const { id } = req.decoded
    const { newPassword, oldPassword, confirmPassword } = req.body
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        if (!newPassword || !oldPassword || !confirmPassword) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ status: 400, message: 'Konfirmasi password tidak sama!' })
        }
        const check = await prisma.user.findFirst({
            where: {
                userId: Number(id)
            },
            select: {
                password: true
            }
        })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        const isValidPassword = await bcrypt.compare(oldPassword, check.password)
        if (!isValidPassword) {
            return res.status(400).json({ status: 400, message: 'Password lama salah!' })
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        const updated = await prisma.user.update({
            where: {
                userId: Number(id)
            },
            data: {
                password: hashedPassword
            }
        })
        return res.status(200).json({ status: 200, message: 'Berhasil mengubah password', data: updated })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}

const histories = async (req, res) => {
    const { id } = req.decoded
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }

        const [bookings, reviews] = await Promise.all([
            prisma.booking.findMany({
                where: {
                    userId: Number(id)
                },
                select: {
                    boardingHouse: {
                        select: {
                            pictures: true,
                            district: true,
                            subdistrict: true,
                            boardingHouseId: true,
                            name: true
                        }
                    },
                    bookedDate: true,                    
                },
                orderBy: {
                    bookedDate: "desc"
                }
            }),
            prisma.review.findMany({
                where: {
                    userId: Number(id)
                },
                select: {
                    boardingHouse: {
                        select: {
                            pictures: true,
                            district: true,
                            subdistrict: true,
                            boardingHouseId: true,
                            name: true
                        }
                    },
                    createdAt: true,
                    rating: true
                },
                orderBy: {
                    createdAt: "desc"
                }
            })
        ])

        const allHistories = []

        for (const booking of bookings) {
            allHistories.push({
                type: "BOOKING",
                boardingHouseId: booking.boardingHouse.boardingHouseId,
                message: `Anda melakukan booking untuk Kos di ${booking.boardingHouse.name}`,
                district: booking.boardingHouse.district,
                subdistrict: booking.boardingHouse.subdistrict,
                time: booking.bookedDate,
                picture: booking.boardingHouse.pictures.length > 0 ? booking.boardingHouse.pictures[0].picture : null,
                timeRelative: getRelativeTime(booking.bookedDate, "id"),
                createdAt: booking.bookedDate
            })
        }

        for (const review of reviews) {
            allHistories.push({
                type: "REVIEW",
                boardingHouseId: review.boardingHouse.boardingHouseId,
                message: `Anda melakukan review dengan rating ${review.rating}⭐ untuk Kos di ${review.boardingHouse.name}`,
                district: review.boardingHouse.district,
                subdistrict: review.boardingHouse.subdistrict,
                time: review.createdAt,
                picture: review.boardingHouse.pictures.length > 0 ? review.boardingHouse.pictures[0].picture : null,
                timeRelative: getRelativeTime(review.createdAt, "id"),
                createdAt: review.createdAt
            })
        }

        allHistories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        return res.status(200).json({ status: 200, message: 'Berhasil mendapatkan riwayat', data: allHistories })

    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan!' })
    }
}


router.get("/", verification(["USER"]), profile)
router.put("/", verification(["USER"]), edit)
router.patch("/", verification(["USER"]), uploadCloudinary("profile").single("picture"), picture)
router.delete("/", verification(["USER"]), deletePicture)
router.post("/login", login)
router.post("/register", register)
router.put("/change-password", verification(["USER"]), changePassword)
router.get("/history", verification(["USER"]), histories)

export default router