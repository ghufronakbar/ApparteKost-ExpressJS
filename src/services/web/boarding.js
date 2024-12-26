import express from 'express'
import prisma from '../../db/prisma.js'
const router = express.Router()
import bcrypt from 'bcrypt'
import { APP_NAME } from "../../constant/index.js"
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
                bookings: true,
                panoramas: true
            }
        })
        if (!data) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        data.averageRating = data.reviews.reduce((a, b) => a + b.rating, 0) / data.reviews.length || 0
        data.dashboard = {
            totalTransactions: data.bookings.length,
            totalRooms: data.maxCapacity,
            totalFilledRooms: data.bookings.filter((b) => b.isActive).length,
            totalFreeRooms: data.maxCapacity - data.bookings.filter((b) => b.isActive).length
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
                phone: true,
                name: true,
                owner: true,
                isPending: true,
                email: true,
                password: true,
                panoramas: true,
            }
        })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        if (isConfirmed && check.panoramas.length === 0) {
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
    const panoramaPictures = req.files
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        if (!panoramaPictures || panoramaPictures?.length === 0) {
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

        const urls = panoramaPictures.map((p) => p.path)

        const data = await prisma.boardingHouse.update({
            where: {
                boardingHouseId: Number(id)
            },
            data: {
                panoramas: { createMany: { data: urls.map((url) => ({ panorama: url })) } }
            },
            include: {
                panoramas: true
            }
        })
        return res.status(200).json({ status: 200, message: "Berhasil mengunggah gambar panorama", data })
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

const dashboard = async (req, res) => {
    try {
        const [users, boardings] = await Promise.all([
            prisma.user.count(),
            prisma.boardingHouse.findMany({ select: { isActive: true, isPending: true } })
        ])
        const data = {
            totalUsers: users,
            totalBoardingHouses: boardings.length,
            totalActiveBoardingHouses: boardings.filter((b) => b.isActive).length,
            totalPendingBoardingHouses: boardings.filter((b) => b.isPending).length,
        }
        return res.status(200).json({ status: 200, message: 'Berhasil mengambil data', data })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const deletePanorama = async (req, res) => {
    const { id } = req.params
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        const check = await prisma.panorama.count({
            where: {
                panoramaId: Number(id)
            }
        })
        if (!check) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        const updated = await prisma.panorama.delete({
            where: {
                panoramaId: Number(id)
            }
        })
        return res.status(200).json({ status: 200, message: "Berhasil menghapus panorama", updated })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

router.get("/dashboard", verification(["ADMIN"]), dashboard)
router.get("/", verification(["ADMIN"]), boardings)
router.get("/:id", verification(["ADMIN", "BOARDING_HOUSE"]), boarding)
router.put("/:id", verification(["ADMIN", "BOARDING_HOUSE"]), edit)
router.patch("/:id/confirm", verification(["ADMIN"]), setConfirm)
router.patch("/:id/active", verification(["ADMIN", "BOARDING_HOUSE"]), setActive)
router.patch("/:id/panorama", verification(["ADMIN", "BOARDING_HOUSE"]), uploadCloudinary("panorama").array("panorama"), setPanorama)
router.delete("/:id/panorama", verification(["ADMIN", "BOARDING_HOUSE"]), deletePanorama)
router.patch("/owner/picture", verification(["BOARDING_HOUSE"]), uploadCloudinary("profile").single("ownerPicture"), setOwnerPicture)

export default router