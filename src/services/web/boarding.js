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
    const id = req.decoded.role === "BOARDING_HOUSE" ? req.decoded.id : req.params.id
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
                reviews: true,
                bookings: true
            }
        })
        if (!data) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        data.averageRating = data.reviews.reduce((a, b) => a + b.rating, 0) / data.reviews.length || 0
        data.dashboard = {
            totalTransaction: data.bookings.length,
            totalRoom: data.maxCapacity,
            totalFilledRoom: data.bookings.filter((b) => b.isActive).length,
            totalFreeRoom: data.maxCapacity - data.bookings.filter((b) => b.isActive).length
        }
        return res.status(200).json({ status: 200, message: 'Detail Kos', data })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const setConfirm = async (req, res) => {
    const { id } = req.params
    const { isConfirmed } = req.body
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        if (typeof isConfirmed !== "boolean") {
            return res.status(400).json({ status: 400, message: 'Status harus berupa boolean!' })
        }
        const check = await prisma.boardingHouse.findFirst({
            where: {
                boardingHouseId: Number(id)
            },
            select: {
                panoramaPicture: true,
                phone: true,
                name: true,
                owner: true,
                isPending: true,
                email: true,
                password: true
            }
        })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        if (isConfirmed && check.panoramaPicture === null) {
            return res.status(400).json({ status: 400, message: 'Unggah gambar panorama terlebih dahulu!' })
        }

        const password = randomCharacter(8)
        const hashedPassword = await bcrypt.hash(password, 10)

        let message = ''
        if ((isConfirmed && check.isPending) || (!check.password && isConfirmed)) {
            message = `*${APP_NAME}*\n\nKos anda telah berhasil terdaftar dan divevisikasi di ApparteKost. \n\nInformasi akun:\nEmail: ${check.email}\nPassword: ${password}\n\nPastikan kamu mengunggah gambar panorama agar kos dapat tampil dalam aplikasi.`
        } else if (isConfirmed && !check.isPending) {
            message = `*${APP_NAME}*\n\nKos: ${check.name} berhasil di aktivasi kembali di ApparteKost. \n\nPastikan kamu mengunggah gambar panorama agar kos dapat tampil dalam aplikasi.`
        } else {
            message = `*${APP_NAME}*\n\n ${check.name} karena suatu hal tidak dapat tampil pada aplikasi.\n\nJika menurut anda ada kesalahan silahkan hubungi admin.`
        }

        if (check && check.phone && message) {
            sendWhatsapp(check.phone, message)
        }
        const data = await prisma.boardingHouse.update({
            where: {
                boardingHouseId: Number(id)
            },
            data: {
                isConfirmed,
                isPending: false,
                password: (isConfirmed && check.isPending) || (!check.password && isConfirmed) ? hashedPassword : check.password
            },
        })
        return res.status(200).json({ status: 200, message: isConfirmed ? 'Kos dikonfirmasi' : 'Kos dinonaktifkan', data })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const setPanorama = async (req, res) => {
    const id = req.decoded.role === "BOARDING_HOUSE" ? req.decoded.id : req.params.id
    const panoramaPicture = req.file
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        if (!panoramaPicture) {
            return res.status(400).json({ status: 400, message: 'Unggah gambar panorama terlebih dahulu!' })
        }
        const check = await prisma.boardingHouse.findFirst({
            where: {
                boardingHouseId: Number(id)
            },
        })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        const data = await prisma.boardingHouse.update({
            where: {
                boardingHouseId: Number(id)
            },
            data: {
                panoramaPicture: panoramaPicture.path,
            },
        })
        return res.status(200).json({ status: 200, message: "Berhasil mengganti gambar panorama", data })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const edit = async (req, res) => {
    const id = req.decoded.role === "BOARDING_HOUSE" ? req.decoded.id : req.params.id
    const { name, owner, phone, description, district, subdistrict, location, maxCapacity, price } = req.body
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        if (!name || !owner || !phone || !description || !district || !subdistrict || !location || !maxCapacity || !price) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        if (isNaN(Number(maxCapacity)) || isNaN(Number(price))) {
            return res.status(400).json({ status: 400, message: 'Harga dan Kapasitas harus berupa angka!' })
        }
        const data = { name, owner, phone, description, district, subdistrict, location, maxCapacity: Number(maxCapacity), price: Number(price) }
        const check = await prisma.boardingHouse.count({
            where: {
                boardingHouseId: Number(id)
            }
        })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        const updated = await prisma.boardingHouse.update({
            where: {
                boardingHouseId: Number(id)
            },
            data
        })
        return res.status(200).json({ status: 200, message: 'Berhasil mengubah data', updated })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const setOwnerPicture = async (req, res) => {
    const { id } = req.decoded
    const ownerPicture = req.file
    try {
        if (!ownerPicture) {
            return res.status(400).json({ status: 400, message: 'Unggah gambar terlebih dahulu!' })
        }
        const check = await prisma.boardingHouse.count({ where: { boardingHouseId: Number(id) } })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }

        const updated = await prisma.boardingHouse.update({
            where: {
                boardingHouseId: Number(id)
            },
            data: {
                ownerPicture: ownerPicture.path,
            },
        })
        return res.status(200).json({ status: 200, message: "Berhasil mengganti foto profil pemilik", updated })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const setActive = async (req, res) => {
    const id = req.decoded.role === "BOARDING_HOUSE" ? req.decoded.id : req.params.id
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        const check = await prisma.boardingHouse.findFirst({ where: { boardingHouseId: Number(id) }, select: { isActive: true } })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        const updated = await prisma.boardingHouse.update({
            where: {
                boardingHouseId: Number(id)
            },
            data: {
                isActive: !check.isActive
            }
        })
        return res.status(200).json({ status: 200, message: updated.isActive ? "Berhasil mengaktifkan" : "Berhasil menonaktifkan", updated })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

router.get("/", verification(["ADMIN"]), boardings)
router.get("/:id", verification(["ADMIN", "BOARDING_HOUSE"]), boarding)
router.put("/:id", verification(["ADMIN", "BOARDING_HOUSE"]), edit)
router.patch("/:id/confirm", verification(["ADMIN"]), setConfirm)
router.patch("/:id/active", verification(["ADMIN", "BOARDING_HOUSE"]), setActive)
router.patch("/:id/panorama", verification(["ADMIN", "BOARDING_HOUSE"]), uploadCloudinary("panorama").single("panorama"), setPanorama)
router.patch("/owner/picture", verification(["BOARDING_HOUSE"]), uploadCloudinary("profile").single("ownerPicture"), setOwnerPicture)

export default router